import { randomUUID } from "node:crypto";
import {
  CallKind,
  CallParticipantStatus,
  CallStatus,
  MeetGenderPreference,
  Prisma,
  UserGender,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const QUEUE_STALE_MS = 45_000;
const CONNECTING_TTL_MS = 15 * 60_000;
const CALL_TTL_MS = 4 * 60 * 60_000;

function preferenceAllows(
  preference: MeetGenderPreference,
  gender: UserGender | null,
) {
  return preference === "ALL" || preference === gender;
}

function countriesCompatible(input: {
  firstCountryId: string | null;
  firstPreferenceId: string | null;
  secondCountryId: string | null;
  secondPreferenceId: string | null;
}) {
  return (
    (!input.firstPreferenceId ||
      input.firstPreferenceId === input.secondCountryId) &&
    (!input.secondPreferenceId ||
      input.secondPreferenceId === input.firstCountryId)
  );
}

function isRetryable(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034") ||
    (error instanceof Error && error.message === "MEET_MATCH_RACE")
  );
}

export async function findMeetMatch(input: {
  userId: string;
  gender: UserGender;
  genderPreference: MeetGenderPreference;
  countryPreferenceId: string | null;
}) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          await tx.meetQueueEntry.deleteMany({
            where: {
              callSessionId: null,
              heartbeatAt: {
                lt: new Date(now.getTime() - QUEUE_STALE_MS),
              },
            },
          });

          const user = await tx.user.update({
            where: { id: input.userId },
            data: { gender: input.gender, lastActiveAt: now },
            select: { id: true, countryId: true, gender: true },
          });
          const existing = await tx.meetQueueEntry.findUnique({
            where: { userId: input.userId },
            include: { callSession: true },
          });
          if (
            existing?.callSession &&
            !["ENDED", "CANCELLED"].includes(existing.callSession.status) &&
            existing.callSession.expiresAt > now
          ) {
            await tx.meetQueueEntry.update({
              where: { userId: input.userId },
              data: { heartbeatAt: now },
            });
            return {
              state: "MATCHED" as const,
              callId: existing.callSession.id,
            };
          }

          await tx.meetQueueEntry.upsert({
            where: { userId: input.userId },
            create: {
              userId: input.userId,
              genderPreference: input.genderPreference,
              countryPreferenceId: input.countryPreferenceId,
              heartbeatAt: now,
            },
            update: {
              genderPreference: input.genderPreference,
              countryPreferenceId: input.countryPreferenceId,
              callSessionId: null,
              heartbeatAt: now,
              createdAt: now,
            },
          });

          const candidates = await tx.meetQueueEntry.findMany({
            where: {
              userId: { not: input.userId },
              callSessionId: null,
              heartbeatAt: {
                gte: new Date(now.getTime() - QUEUE_STALE_MS),
              },
              user: { status: "ACTIVE", gender: { not: null } },
            },
            include: {
              user: { select: { id: true, countryId: true, gender: true } },
            },
            orderBy: { createdAt: "asc" },
            take: 40,
          });
          const candidateIds = candidates.map((candidate) => candidate.userId);
          const blocks = candidateIds.length
            ? await tx.userBlock.findMany({
                where: {
                  OR: [
                    {
                      blockerId: input.userId,
                      blockedId: { in: candidateIds },
                    },
                    {
                      blockerId: { in: candidateIds },
                      blockedId: input.userId,
                    },
                  ],
                },
                select: { blockerId: true, blockedId: true },
              })
            : [];
          const blockedIds = new Set(
            blocks.map((block) =>
              block.blockerId === input.userId
                ? block.blockedId
                : block.blockerId,
            ),
          );
          const candidate = candidates.find(
            (entry) =>
              !blockedIds.has(entry.userId) &&
              preferenceAllows(input.genderPreference, entry.user.gender) &&
              preferenceAllows(entry.genderPreference, user.gender) &&
              countriesCompatible({
                firstCountryId: user.countryId,
                firstPreferenceId: input.countryPreferenceId,
                secondCountryId: entry.user.countryId,
                secondPreferenceId: entry.countryPreferenceId,
              }),
          );
          if (!candidate) return { state: "WAITING" as const };

          const call = await tx.callSession.create({
            data: {
              roomName: `meet-${randomUUID()}`,
              kind: "MEET",
              status: "CONNECTING",
              createdById: input.userId,
              expiresAt: new Date(now.getTime() + CONNECTING_TTL_MS),
              participants: {
                create: [
                  { userId: input.userId },
                  { userId: candidate.userId },
                ],
              },
            },
          });
          const [mine, theirs] = await Promise.all([
            tx.meetQueueEntry.updateMany({
              where: { userId: input.userId, callSessionId: null },
              data: { callSessionId: call.id, heartbeatAt: now },
            }),
            tx.meetQueueEntry.updateMany({
              where: { userId: candidate.userId, callSessionId: null },
              data: { callSessionId: call.id, heartbeatAt: now },
            }),
          ]);
          if (mine.count !== 1 || theirs.count !== 1) {
            throw new Error("MEET_MATCH_RACE");
          }
          return { state: "MATCHED" as const, callId: call.id };
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 12_000 },
      );
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 3) throw error;
    }
  }
  throw lastError;
}

export async function leaveMeetQueue(userId: string) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.meetQueueEntry.findUnique({
      where: { userId },
      select: { callSessionId: true },
    });
    await tx.meetQueueEntry.deleteMany({ where: { userId } });
    if (entry?.callSessionId) {
      await markCallParticipant(tx, entry.callSessionId, userId, "LEFT");
    }
  });
}

async function markCallParticipant(
  tx: Prisma.TransactionClient,
  callId: string,
  userId: string,
  status: CallParticipantStatus,
) {
  const now = new Date();
  const changed = await tx.callParticipant.updateMany({
    where: { callSessionId: callId, userId },
    data: {
      status,
      joinedAt: status === "JOINED" ? now : undefined,
      leftAt: status === "LEFT" ? now : null,
    },
  });
  if (!changed.count) return false;
  const joined = await tx.callParticipant.count({
    where: { callSessionId: callId, status: "JOINED" },
  });
  const remaining = await tx.callParticipant.count({
    where: { callSessionId: callId, status: { not: "LEFT" } },
  });
  await tx.callSession.update({
    where: { id: callId },
    data:
      remaining < 2
        ? { status: "ENDED", endedAt: now }
        : joined >= 2
          ? {
              status: "ACTIVE",
              connectedAt: now,
              expiresAt: new Date(now.getTime() + CALL_TTL_MS),
            }
          : {},
  });
  return true;
}

export async function updateCallPresence(input: {
  callId: string;
  userId: string;
  status: "JOINED" | "LEFT";
}) {
  return prisma.$transaction((tx) =>
    markCallParticipant(tx, input.callId, input.userId, input.status),
  );
}

export async function createPrivateCall(input: {
  conversationId: string;
  userId: string;
  kind: Exclude<CallKind, "MEET">;
}) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: {
        id: input.conversationId,
        participants: { some: { userId: input.userId, deletedAt: null } },
      },
      select: {
        participants: {
          where: { deletedAt: null },
          select: { userId: true },
        },
      },
    });
    if (!conversation || conversation.participants.length !== 2) return null;
    const otherId = conversation.participants.find(
      (participant) => participant.userId !== input.userId,
    )?.userId;
    if (!otherId) return null;
    const block = await tx.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: input.userId, blockedId: otherId },
          { blockerId: otherId, blockedId: input.userId },
        ],
      },
    });
    if (block) throw new Error("Calls are unavailable for this conversation.");
    const active = await tx.callSession.findFirst({
      where: {
        conversationId: input.conversationId,
        status: { in: ["CONNECTING", "ACTIVE"] },
        expiresAt: { gt: new Date() },
      },
      select: { id: true, kind: true },
      orderBy: { createdAt: "desc" },
    });
    if (active) return active;
    const call = await tx.callSession.create({
      data: {
        roomName: `private-${randomUUID()}`,
        kind: input.kind,
        conversationId: input.conversationId,
        createdById: input.userId,
        expiresAt: new Date(Date.now() + CONNECTING_TTL_MS),
        participants: {
          create: conversation.participants.map((participant) => ({
            userId: participant.userId,
          })),
        },
      },
      select: { id: true, kind: true },
    });
    await tx.notification.create({
      data: {
        recipientId: otherId,
        actorId: input.userId,
        type: "MESSAGE",
        title:
          input.kind === "VIDEO"
            ? "Incoming video call"
            : "Incoming audio call",
        body: "Open the conversation to answer.",
        href: `/messages/${input.conversationId}`,
        dedupeKey: `call:${call.id}`,
        data: { callId: call.id, callKind: input.kind },
      },
    });
    return call;
  });
}

export async function getAvailablePrivateCall(
  conversationId: string,
  userId: string,
) {
  return prisma.callSession.findFirst({
    where: {
      conversationId,
      status: { in: [CallStatus.CONNECTING, CallStatus.ACTIVE] },
      expiresAt: { gt: new Date() },
      participants: { some: { userId, status: { not: "LEFT" } } },
    },
    select: { id: true, kind: true, createdById: true, status: true },
    orderBy: { createdAt: "desc" },
  });
}
