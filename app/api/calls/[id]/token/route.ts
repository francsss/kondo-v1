import { NextRequest } from "next/server";
import { callMediaProvider } from "@/lib/calls/provider";
import { logServerError, logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const call = await prisma.callSession.findFirst({
      where: {
        id: (await params).id,
        status: { in: ["CONNECTING", "ACTIVE"] },
        expiresAt: { gt: new Date() },
        participants: { some: { userId: user.id, status: { not: "LEFT" } } },
      },
      select: {
        id: true,
        roomName: true,
        kind: true,
        participants: {
          where: { userId: { not: user.id } },
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarMediaId: true,
              },
            },
          },
        },
      },
    });
    if (!call)
      return jsonError("This call is unavailable or has expired.", 404);
    const other = call.participants[0]?.user;
    if (other) {
      const blocked = await prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: user.id, blockedId: other.id },
            { blockerId: other.id, blockedId: user.id },
          ],
        },
      });
      if (blocked) return jsonError("This call is no longer available.", 403);
    }
    try {
      await callMediaProvider.prepareRoom({ roomName: call.roomName });
    } catch (error) {
      logServerError("calls.livekit.room_failed", error, {
        callId: call.id,
        callKind: call.kind,
        provider: "livekit",
      });
      return jsonError(
        "The video service is temporarily unavailable. Please try again.",
        503,
      );
    }
    logServerEvent("calls.room.ready", {
      callId: call.id,
      callKind: call.kind,
      provider: "livekit",
    });
    let access: Awaited<
      ReturnType<typeof callMediaProvider.createParticipantAccess>
    >;
    try {
      access = await callMediaProvider.createParticipantAccess({
        roomName: call.roomName,
        userId: user.id,
        displayName: `${user.firstName} ${user.lastName}`,
      });
    } catch (error) {
      logServerError("calls.livekit.token_failed", error, {
        callId: call.id,
        callKind: call.kind,
        provider: "livekit",
      });
      return jsonError(
        "The secure call token could not be generated. Please try again.",
        503,
      );
    }
    logServerEvent("calls.token.generated", {
      callId: call.id,
      callKind: call.kind,
      userId: user.id,
      expiresInSeconds: access.expiresInSeconds,
      provider: "livekit",
    });
    return Response.json(
      { ...access, kind: call.kind, otherParticipant: other ?? null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return internalApiError("calls.token", error);
  }
}
