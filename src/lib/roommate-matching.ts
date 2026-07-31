import type { RoommateInterestStatus } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { roommateInterestSchema } from "@/features/housing/schemas";
import { createDirectMessage } from "@/lib/messaging";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export class RoommateInterestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "RoommateInterestError";
  }
}

async function assertNotBlocked(firstUserId: string, secondUserId: string) {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: firstUserId, blockedId: secondUserId },
        { blockerId: secondUserId, blockedId: firstUserId },
      ],
    },
    select: { blockerId: true },
  });
  if (block)
    throw new RoommateInterestError("This profile is unavailable.", 404);
}

export async function sendRoommateInterest(input: {
  actorId: string;
  data: Parameters<typeof roommateInterestSchema.parse>[0];
  meta?: RequestMeta;
}) {
  const data = roommateInterestSchema.parse(input.data);
  if (data.recipientUserId === input.actorId) {
    throw new RoommateInterestError("You cannot send interest to yourself.");
  }
  await assertNotBlocked(input.actorId, data.recipientUserId);
  const [senderProfile, recipientProfile, sender] = await Promise.all([
    prisma.roommateProfile.findUnique({
      where: { userId: input.actorId },
      select: { status: true, visibility: true },
    }),
    prisma.roommateProfile.findUnique({
      where: { userId: data.recipientUserId },
      select: {
        id: true,
        status: true,
        visibility: true,
        allowInterests: true,
        expiresAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: input.actorId },
      select: { firstName: true, lastName: true },
    }),
  ]);
  if (senderProfile?.status !== "ACTIVE") {
    throw new RoommateInterestError(
      "Activate your roommate profile before sending interest.",
      409,
    );
  }
  if (
    !recipientProfile ||
    recipientProfile.status !== "ACTIVE" ||
    recipientProfile.visibility !== "MEMBERS_ONLY" ||
    !recipientProfile.allowInterests ||
    (recipientProfile.expiresAt && recipientProfile.expiresAt <= new Date())
  ) {
    throw new RoommateInterestError("Roommate profile not found.", 404);
  }
  const now = new Date();
  try {
    const interest = await prisma.$transaction(async (tx) => {
      const created = await tx.roommateInterest.create({
        data: {
          senderUserId: input.actorId,
          recipientUserId: data.recipientUserId,
          message: data.message,
          expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60_000),
        },
        select: { id: true, status: true, createdAt: true },
      });
      await enqueueNotificationJobWithClient(tx, {
        recipientId: data.recipientUserId,
        actorId: input.actorId,
        type: "HOUSING",
        templateKey: "ROOMMATE_INTEREST",
        data: {
          actorName:
            `${sender?.firstName ?? ""} ${sender?.lastName ?? ""}`.trim() ||
            "A Kondo member",
        },
        href: "/housing/roommates?tab=interests",
        dedupeKey: `roommate-interest:${created.id}:sent`,
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actorId,
        action: "ROOMMATE_INTEREST_SENT",
        entityType: "RoommateInterest",
        entityId: created.id,
        newValue: { recipientUserId: data.recipientUserId },
        ...input.meta,
      });
      return created;
    });
    await captureServerProductEvent({
      distinctId: input.actorId,
      event: PRODUCT_EVENTS.ROOMMATE_INTEREST_SENT,
    });
    return interest;
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new RoommateInterestError(
        "You already have an active interest with this person.",
        409,
      );
    }
    throw error;
  }
}

const interestTransitions: Record<
  RoommateInterestStatus,
  readonly RoommateInterestStatus[]
> = {
  SENT: ["ACCEPTED", "DECLINED", "WITHDRAWN"],
  ACCEPTED: [],
  DECLINED: [],
  WITHDRAWN: [],
  EXPIRED: [],
  BLOCKED: [],
};

export async function transitionRoommateInterest(input: {
  actorId: string;
  interestId: string;
  to: Extract<RoommateInterestStatus, "ACCEPTED" | "DECLINED" | "WITHDRAWN">;
  meta?: RequestMeta;
}) {
  const interest = await prisma.roommateInterest.findUnique({
    where: { id: input.interestId },
    select: {
      id: true,
      senderUserId: true,
      recipientUserId: true,
      status: true,
      expiresAt: true,
    },
  });
  if (!interest) throw new RoommateInterestError("Interest not found.", 404);
  const isSender = interest.senderUserId === input.actorId;
  const isRecipient = interest.recipientUserId === input.actorId;
  if (
    (!isSender && !isRecipient) ||
    (input.to === "WITHDRAWN" && !isSender) ||
    (input.to !== "WITHDRAWN" && !isRecipient)
  ) {
    throw new RoommateInterestError("Interest not found.", 404);
  }
  await assertNotBlocked(interest.senderUserId, interest.recipientUserId);
  if (
    interest.expiresAt <= new Date() ||
    !interestTransitions[interest.status].includes(input.to)
  ) {
    throw new RoommateInterestError(
      "This interest can no longer be changed.",
      409,
    );
  }
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const changed = await tx.roommateInterest.updateMany({
      where: { id: interest.id, status: interest.status },
      data: { status: input.to, respondedAt: now },
    });
    if (!changed.count) {
      throw new RoommateInterestError(
        "This interest changed in another session.",
        409,
      );
    }
    const recipientId = isSender
      ? interest.recipientUserId
      : interest.senderUserId;
    await enqueueNotificationJobWithClient(tx, {
      recipientId,
      actorId: input.actorId,
      type: "HOUSING",
      templateKey: "ROOMMATE_INTEREST_UPDATE",
      data: {
        actorName: "A Kondo member",
        outcome: input.to.toLowerCase(),
      },
      href: "/housing/roommates?tab=interests",
      dedupeKey: `roommate-interest:${interest.id}:${input.to}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "ROOMMATE_INTEREST_STATUS_CHANGED",
      entityType: "RoommateInterest",
      entityId: interest.id,
      oldValue: { status: interest.status },
      newValue: { status: input.to },
      ...input.meta,
    });
  });
  let conversationId: string | null = null;
  if (input.to === "ACCEPTED") {
    const result = await createDirectMessage({
      senderId: input.actorId,
      recipientId: interest.senderUserId,
      body: "Roommate interest accepted — you can now continue the conversation here.",
      sourceType: "ROOMMATE_INTEREST",
      sourceId: interest.id,
    });
    conversationId = result.conversationId;
    await prisma.roommateInterest.update({
      where: { id: interest.id },
      data: { conversationId },
    });
    await captureServerProductEvent({
      distinctId: input.actorId,
      event: PRODUCT_EVENTS.ROOMMATE_INTEREST_ACCEPTED,
    });
  }
  return { id: interest.id, status: input.to, conversationId };
}

export async function listRoommateInterests(userId: string) {
  return prisma.roommateInterest.findMany({
    where: {
      OR: [{ senderUserId: userId }, { recipientUserId: userId }],
    },
    select: {
      id: true,
      status: true,
      message: true,
      conversationId: true,
      createdAt: true,
      expiresAt: true,
      sender: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarMediaId: true,
        },
      },
      recipient: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarMediaId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}
