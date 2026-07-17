import { BookmarkTargetType } from "@prisma/client";
import { NextRequest } from "next/server";
import { bookmarkTargetIsVisible } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = {
  params: Promise<{ targetType: string; targetId: string }>;
};

function parseTargetType(value: string) {
  return Object.values(BookmarkTargetType).find((type) => type === value);
}

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { targetType: rawTargetType, targetId } = await params;
  const targetType = parseTargetType(rawTargetType);
  if (!targetType) return jsonError("Invalid bookmark type.");
  if (!(await bookmarkTargetIsVisible(user, targetType, targetId))) {
    return jsonError("Bookmark target not found.", 404);
  }

  const bookmark = await prisma.bookmark.findUnique({
    where: {
      userId_targetType_targetId: { userId: user.id, targetType, targetId },
    },
    select: { id: true },
  });
  return Response.json({ bookmarked: Boolean(bookmark) });
}

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { targetType: rawTargetType, targetId } = await params;
  const targetType = parseTargetType(rawTargetType);
  if (!targetType) return jsonError("Invalid bookmark type.");
  if (!(await bookmarkTargetIsVisible(user, targetType, targetId)))
    return jsonError("Bookmark target not found.", 404);

  const bookmark = await prisma.bookmark.upsert({
    where: {
      userId_targetType_targetId: { userId: user.id, targetType, targetId },
    },
    create: { userId: user.id, targetType, targetId },
    update: {},
    select: { id: true },
  });
  return Response.json({ bookmarked: Boolean(bookmark.id) }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { targetType: rawTargetType, targetId } = await params;
  const targetType = parseTargetType(rawTargetType);
  if (!targetType) return jsonError("Invalid bookmark type.");

  await prisma.bookmark.deleteMany({
    where: { userId: user.id, targetType, targetId },
  });
  return new Response(null, { status: 204 });
}
