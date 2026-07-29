import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import {
  canAccessAdmin,
  hasAdminPermission,
  type AdminPermission,
} from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const currentUserSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarKey: true,
  avatarMediaId: true,
  role: true,
  status: true,
  storyCreatorStatus: true,
  officialProfileStatus: true,
  officialOrganizationType: true,
  officialOrganizationName: true,
  officialVerifiedAt: true,
  officialReviewDueAt: true,
  gender: true,
  countryId: true,
  cityId: true,
  universityId: true,
  degree: true,
  studyLevel: true,
  studentJourney: true,
  nearbyDiscoveryEnabled: true,
  meetIntents: true,
  studyYear: true,
  arrivalDate: true,
  languages: true,
  interests: true,
  onboardingCompletedAt: true,
  profileAudience: true,
  preference: {
    select: {
      theme: true,
      language: true,
      notificationSounds: true,
      notificationHaptics: true,
    },
  },
  createdAt: true,
  country: { select: { code: true, name: true, emoji: true } },
  city: { select: { slug: true, name: true } },
  university: { select: { slug: true, name: true, shortName: true } },
} satisfies Prisma.UserSelect;

type SessionClient = Pick<Prisma.TransactionClient, "session">;

export function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export function hashSecurityIdentifier(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export async function createDatabaseSession(
  {
    userId,
    ipAddress,
    userAgent,
  }: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
  client: SessionClient = prisma,
) {
  const sessionId = randomBytes(32).toString("base64url");
  await client.session.create({
    data: {
      tokenHash: hashSessionId(sessionId),
      userId,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return sessionId;
}

export async function revokeDatabaseSession({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  return prisma.session.deleteMany({
    where: {
      tokenHash: hashSessionId(sessionId),
      userId,
    },
  });
}

export async function revokeAllDatabaseSessions(userId: string) {
  return prisma.session.deleteMany({ where: { userId } });
}

export async function resolveAuthenticatedUser(token?: string | null) {
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const databaseSession = await prisma.session.findUnique({
    where: { tokenHash: hashSessionId(session.sessionId) },
    select: {
      userId: true,
      expiresAt: true,
      user: { select: currentUserSelect },
    },
  });

  if (
    !databaseSession ||
    databaseSession.userId !== session.id ||
    databaseSession.expiresAt <= new Date()
  ) {
    if (databaseSession?.expiresAt && databaseSession.expiresAt <= new Date()) {
      await revokeDatabaseSession({
        sessionId: session.sessionId,
        userId: databaseSession.userId,
      });
    }
    return null;
  }

  const user = databaseSession.user;
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

export const getCurrentUser = cache(async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  return resolveAuthenticatedUser(token);
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!canAccessAdmin(user.role)) redirect("/home");
  return user;
}

export async function requireAdminPermission(permission: AdminPermission) {
  const user = await requireUser();
  if (!hasAdminPermission(user.role, permission)) redirect("/admin/forbidden");
  return user;
}
