import { NextRequest } from "next/server";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

async function authorize(request: NextRequest, targetId: string) {
  if (!hasTrustedOrigin(request)) {
    return { error: jsonError("Invalid request origin.", 403) };
  }
  const user = await getCurrentUser();
  if (!user) return { error: jsonError("Authentication required.", 401) };
  if (user.id === targetId) {
    return { error: jsonError("You cannot block yourself.", 400) };
  }
  return { user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.error) return auth.error;
  const user = auth.user!;
  if (!rateLimit(`block:${user.id}`, 20, 24 * 60 * 60_000).allowed) {
    return jsonError("Block limit reached. Try again later.", 429);
  }

  try {
    const metadata = getRequestMeta(request);
    const blocked = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!target) return false;
      await tx.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: user.id, blockedId: id } },
        create: { blockerId: user.id, blockedId: id },
        update: {},
      });
      await writeAuditLogWithClient(tx, {
        actorId: user.id,
        action: "USER_BLOCKED",
        entityType: "User",
        entityId: id,
        ...metadata,
      });
      return true;
    });
    if (!blocked) return jsonError("User not found.", 404);
    return Response.json({ blocked: true });
  } catch (error) {
    return internalApiError("user.block", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if (auth.error) return auth.error;
  const user = auth.user!;

  try {
    const metadata = getRequestMeta(request);
    await prisma.$transaction(async (tx) => {
      await tx.userBlock.deleteMany({
        where: { blockerId: user.id, blockedId: id },
      });
      await writeAuditLogWithClient(tx, {
        actorId: user.id,
        action: "USER_UNBLOCKED",
        entityType: "User",
        entityId: id,
        ...metadata,
      });
    });
    return Response.json({ blocked: false });
  } catch (error) {
    return internalApiError("user.unblock", error);
  }
}
