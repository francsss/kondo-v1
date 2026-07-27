import { Prisma, type UserGender } from "@prisma/client";
import { getAfricanCountry } from "@/lib/african-countries";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  enqueueNotificationJobWithClient,
  processNotificationJobNow,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { createDatabaseSession } from "@/lib/server-auth";

export class RegistrationConfigurationError extends Error {}

type RegistrationInput = {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  gender: UserGender;
  countryCode: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

function isRetryableRegistrationError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

export async function registerUserWithNationalCommunity(
  input: RegistrationInput,
) {
  const countryReference = getAfricanCountry(input.countryCode);
  if (!countryReference) throw new Error("Unsupported country code.");

  let finalError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const country = await tx.country.upsert({
            where: { code: countryReference.code },
            create: {
              code: countryReference.code,
              name: countryReference.name,
              emoji: countryReference.emoji,
              isActive: true,
              verified: true,
            },
            update: {
              emoji: countryReference.emoji,
              isActive: true,
            },
          });

          const globalAdmins = await tx.user.findMany({
            where: {
              role: { in: ["SUPER_ADMIN", "ADMIN"] },
            },
            select: { id: true, role: true },
            orderBy: [
              { status: "asc" },
              { role: "desc" },
              { createdAt: "asc" },
            ],
          });
          const primaryAdmin =
            globalAdmins.find((admin) => admin.role === "SUPER_ADMIN") ??
            globalAdmins[0];
          if (!primaryAdmin) {
            throw new RegistrationConfigurationError(
              "Kondo needs a global administrator before national communities can be created.",
            );
          }

          const createdUser = await tx.user.create({
            data: {
              email: input.email,
              passwordHash: input.passwordHash,
              firstName: input.firstName,
              lastName: input.lastName,
              gender: input.gender,
              countryId: country.id,
              role: "MEMBER",
            },
          });

          let community = await tx.community.findFirst({
            where: {
              countryId: country.id,
              type: "COUNTRY",
              isOfficial: true,
            },
            select: { id: true, ownerId: true },
          });

          if (!community) {
            community = await tx.community.create({
              data: {
                slug: `national-${countryReference.code.toLowerCase()}`,
                name: countryReference.name,
                description: `The official Kondo community for students from ${countryReference.name}.`,
                type: "COUNTRY",
                status: "ACTIVE",
                joinPolicy: "OPEN",
                icon: countryReference.emoji,
                isVerified: true,
                isOfficial: true,
                isPrivate: false,
                countryId: country.id,
                createdById: primaryAdmin.id,
                ownerId: primaryAdmin.id,
              },
              select: { id: true, ownerId: true },
            });
          }

          await tx.communityMember.createMany({
            data: globalAdmins.map((admin) => ({
              communityId: community!.id,
              userId: admin.id,
              role:
                admin.id === community!.ownerId
                  ? ("OWNER" as const)
                  : ("MODERATOR" as const),
            })),
            skipDuplicates: true,
          });
          await tx.communityMember.updateMany({
            where: {
              communityId: community.id,
              userId: { in: globalAdmins.map((admin) => admin.id) },
              role: "MEMBER",
            },
            data: { role: "MODERATOR" },
          });
          await tx.communityMember.create({
            data: {
              communityId: community.id,
              userId: createdUser.id,
              role: "MEMBER",
            },
          });

          const sessionId = await createDatabaseSession(
            {
              userId: createdUser.id,
              ipAddress: input.ipAddress,
              userAgent: input.userAgent,
            },
            tx,
          );
          await writeAuditLogWithClient(tx, {
            actorId: createdUser.id,
            action: "USER_REGISTERED",
            entityType: "User",
            entityId: createdUser.id,
            newValue: {
              role: createdUser.role,
              countryCode: countryReference.code,
              nationalCommunityId: community.id,
            },
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          });
          const welcomeJob = await enqueueNotificationJobWithClient(tx, {
            recipientId: createdUser.id,
            type: "ACCOUNT",
            templateKey: "ACCOUNT_WELCOME",
            data: { firstName: createdUser.firstName },
            href: "/onboarding",
            dedupeKey: `account-welcome:${createdUser.id}`,
          });
          return {
            user: createdUser,
            sessionId,
            communityId: community.id,
            welcomeJobId: welcomeJob?.id ?? null,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      );
      if (result.welcomeJobId) {
        await processNotificationJobNow(result.welcomeJobId).catch(() => null);
      }
      return result;
    } catch (error) {
      finalError = error;
      if (!isRetryableRegistrationError(error) || attempt === 3) throw error;
    }
  }
  throw finalError;
}
