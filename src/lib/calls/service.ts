import { randomUUID } from "node:crypto";
import {
  CallKind,
  CallParticipantStatus,
  CallStatus,
  MeetGenderPreference,
  MeetMode,
  Prisma,
  UserGender,
} from "@prisma/client";
import { callMediaProvider, isLiveKitConfigured } from "@/lib/calls/provider";
import { logServerError, logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const QUEUE_STALE_MS = 45_000;
const CONNECTING_TTL_MS = 15 * 60_000;
const CALL_TTL_MS = 4 * 60 * 60_000;

type MatchDiagnostics = {
  staleQueueEntriesRemoved: number;
  expiredCallsCancelled: number;
  freshCandidates: number;
  inactive: number;
  missingGender: number;
  blocked: number;
  occupied: number;
  genderMismatch: number;
  countryMismatch: number;
  nearbyMismatch: number;
  intentMismatch: number;
};

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
  mode?: MeetMode;
  intents?: string[];
  nearbyEnabled?: boolean;
}) {
  const mode = input.mode ?? "RANDOM";
  const intents = input.intents ?? [];
  const nearbyEnabled = input.nearbyEnabled ?? false;
  logServerEvent("meet.queue.join.requested", {
    userId: input.userId,
    hasCountryPreference: Boolean(input.countryPreferenceId),
  });
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const now = new Date();
          const expiredCalls = await tx.callSession.updateMany({
            where: {
              kind: "MEET",
              status: { in: ["CONNECTING", "ACTIVE"] },
              expiresAt: { lte: now },
            },
            data: { status: "CANCELLED", endedAt: now },
          });
          const staleEntries = await tx.meetQueueEntry.deleteMany({
            where: {
              callSessionId: null,
              heartbeatAt: {
                lt: new Date(now.getTime() - QUEUE_STALE_MS),
              },
            },
          });
          const diagnostics: MatchDiagnostics = {
            staleQueueEntriesRemoved: staleEntries.count,
            expiredCallsCancelled: expiredCalls.count,
            freshCandidates: 0,
            inactive: 0,
            missingGender: 0,
            blocked: 0,
            occupied: 0,
            genderMismatch: 0,
            countryMismatch: 0,
            nearbyMismatch: 0,
            intentMismatch: 0,
          };

          const user = await tx.user.update({
            where: { id: input.userId },
            data: {
              gender: input.gender,
              lastActiveAt: now,
              ...(mode === "RANDOM"
                ? {}
                : {
                    nearbyDiscoveryEnabled: nearbyEnabled,
                    meetIntents: { set: intents },
                  }),
            },
            select: {
              id: true,
              countryId: true,
              cityId: true,
              gender: true,
              nearbyDiscoveryEnabled: true,
              meetIntents: true,
            },
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
              resumed: true,
              diagnostics,
            };
          }

          const occupiedCall = await tx.callParticipant.findFirst({
            where: {
              userId: input.userId,
              status: { not: "LEFT" },
              callSession: {
                status: { in: ["CONNECTING", "ACTIVE"] },
                expiresAt: { gt: now },
              },
            },
            select: { callSessionId: true },
            orderBy: { createdAt: "desc" },
          });
          if (occupiedCall) {
            return {
              state: "BUSY" as const,
              callId: occupiedCall.callSessionId,
              diagnostics,
            };
          }

          await tx.meetQueueEntry.upsert({
            where: { userId: input.userId },
            create: {
              userId: input.userId,
              genderPreference: input.genderPreference,
              mode,
              intents,
              countryPreferenceId: input.countryPreferenceId,
              heartbeatAt: now,
            },
            update: {
              genderPreference: input.genderPreference,
              mode,
              intents: { set: intents },
              countryPreferenceId: input.countryPreferenceId,
              callSessionId: null,
              heartbeatAt: now,
              createdAt: now,
            },
          });

          const candidates = await tx.meetQueueEntry.findMany({
            where: {
              userId: { not: input.userId },
              mode,
              callSessionId: null,
              heartbeatAt: {
                gte: new Date(now.getTime() - QUEUE_STALE_MS),
              },
            },
            include: {
              user: {
                select: {
                  id: true,
                  countryId: true,
                  cityId: true,
                  gender: true,
                  status: true,
                  nearbyDiscoveryEnabled: true,
                  meetIntents: true,
                  callParticipations: {
                    where: {
                      status: { not: "LEFT" },
                      callSession: {
                        status: { in: ["CONNECTING", "ACTIVE"] },
                        expiresAt: { gt: now },
                      },
                    },
                    select: { callSessionId: true },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { createdAt: "asc" },
            take: 40,
          });
          diagnostics.freshCandidates = candidates.length;
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
          let candidate: (typeof candidates)[number] | undefined;
          for (const entry of candidates) {
            if (entry.user.status !== "ACTIVE") {
              diagnostics.inactive += 1;
              continue;
            }
            if (!entry.user.gender) {
              diagnostics.missingGender += 1;
              continue;
            }
            if (blockedIds.has(entry.userId)) {
              diagnostics.blocked += 1;
              continue;
            }
            if (entry.user.callParticipations.length > 0) {
              diagnostics.occupied += 1;
              continue;
            }
            if (
              !preferenceAllows(input.genderPreference, entry.user.gender) ||
              !preferenceAllows(entry.genderPreference, user.gender)
            ) {
              diagnostics.genderMismatch += 1;
              continue;
            }
            if (
              !countriesCompatible({
                firstCountryId: user.countryId,
                firstPreferenceId: input.countryPreferenceId,
                secondCountryId: entry.user.countryId,
                secondPreferenceId: entry.countryPreferenceId,
              })
            ) {
              diagnostics.countryMismatch += 1;
              continue;
            }
            if (
              mode === "NEARBY" &&
              (!nearbyEnabled ||
                !entry.user.nearbyDiscoveryEnabled ||
                !user.cityId ||
                user.cityId !== entry.user.cityId)
            ) {
              diagnostics.nearbyMismatch += 1;
              continue;
            }
            if (
              mode === "LOOKING_FOR" &&
              !intents.some((intent) => entry.user.meetIntents.includes(intent))
            ) {
              diagnostics.intentMismatch += 1;
              continue;
            }
            candidate = entry;
            break;
          }
          if (!candidate) {
            return { state: "WAITING" as const, diagnostics };
          }

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
          return {
            state: "MATCHED" as const,
            callId: call.id,
            resumed: false,
            diagnostics,
          };
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 12_000 },
      );
      if (result.diagnostics.staleQueueEntriesRemoved > 0) {
        logServerEvent("meet.queue.cleanup", {
          removed: result.diagnostics.staleQueueEntriesRemoved,
          expiredCallsCancelled: result.diagnostics.expiredCallsCancelled,
        });
      }
      if (result.state === "MATCHED") {
        logServerEvent(
          result.resumed ? "meet.match.resumed" : "meet.match.created",
          {
            callId: result.callId,
            userId: input.userId,
            candidateFound: true,
          },
        );
        return { state: "MATCHED" as const, callId: result.callId };
      }
      if (result.state === "BUSY") {
        logServerEvent("meet.queue.rejected_busy", {
          callId: result.callId,
          userId: input.userId,
        });
        return { state: "BUSY" as const, callId: result.callId };
      }
      logServerEvent("meet.match.waiting", {
        userId: input.userId,
        ...result.diagnostics,
      });
      return { state: "WAITING" as const };
    } catch (error) {
      lastError = error;
      logServerError("meet.match.attempt_failed", error, {
        userId: input.userId,
        attempt,
        retryable: isRetryable(error),
      });
      if (!isRetryable(error) || attempt === 3) throw error;
    }
  }
  throw lastError;
}

export async function leaveMeetQueue(userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const entry = await tx.meetQueueEntry.findUnique({
      where: { userId },
      select: { callSessionId: true },
    });
    const removed = await tx.meetQueueEntry.deleteMany({ where: { userId } });
    if (entry?.callSessionId) {
      const call = await markCallParticipant(
        tx,
        entry.callSessionId,
        userId,
        "LEFT",
      );
      return { removed: removed.count, call };
    }
    return { removed: removed.count, call: null };
  });
  logServerEvent("meet.queue.leave", {
    userId,
    removed: result.removed,
    callId: result.call?.callId,
    callEnded: result.call?.ended,
  });
  await closeEndedRoom(result.call);
  return result;
}

async function closeEndedRoom(
  call: Awaited<ReturnType<typeof markCallParticipant>> | null,
) {
  if (!call?.ended || !call.roomName || !isLiveKitConfigured()) return;
  try {
    await callMediaProvider.closeRoom(call.roomName);
    logServerEvent("calls.room.cleaned", {
      callId: call.callId,
      provider: "livekit",
    });
  } catch (error) {
    logServerError("calls.room.cleanup_failed", error, {
      callId: call.callId,
      provider: "livekit",
    });
  }
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
  if (!changed.count) return null;
  const joined = await tx.callParticipant.count({
    where: { callSessionId: callId, status: "JOINED" },
  });
  const remaining = await tx.callParticipant.count({
    where: { callSessionId: callId, status: { not: "LEFT" } },
  });
  const ended = remaining < 2;
  const call = await tx.callSession.update({
    where: { id: callId },
    data: ended
      ? { status: "ENDED", endedAt: now }
      : joined >= 2
        ? {
            status: "ACTIVE",
            connectedAt: now,
            expiresAt: new Date(now.getTime() + CALL_TTL_MS),
          }
        : {},
    select: { id: true, roomName: true, status: true },
  });
  return {
    callId: call.id,
    roomName: call.roomName,
    status: call.status,
    ended,
  };
}

export async function updateCallPresence(input: {
  callId: string;
  userId: string;
  status: "JOINED" | "LEFT";
}) {
  const result = await prisma.$transaction((tx) =>
    markCallParticipant(tx, input.callId, input.userId, input.status),
  );
  if (!result) return false;
  logServerEvent(
    input.status === "JOINED"
      ? "calls.participant.connected"
      : "calls.participant.left",
    {
      callId: input.callId,
      userId: input.userId,
      callStatus: result.status,
    },
  );
  await closeEndedRoom(result);
  return true;
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
