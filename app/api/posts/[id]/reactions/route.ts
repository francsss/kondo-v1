import { NextRequest } from "next/server";
import { publishedPostVisibilityWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { reactionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: postId } = await params;
  const parsed = reactionSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) return jsonError("Invalid reaction.");

  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      ...publishedPostVisibilityWhere(user, { moderatorOverride: true }),
    },
    select: { id: true },
  });
  if (!post) return jsonError("Post not found.", 404);

  const reaction = await prisma.reaction.upsert({
    where: {
      userId_postId_type: { userId: user.id, postId, type: parsed.data.type },
    },
    create: { userId: user.id, postId, type: parsed.data.type },
    update: {},
    select: { id: true },
  });
  return Response.json(
    { reacted: Boolean(reaction.id), type: parsed.data.type },
    { status: 201 },
  );
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: postId } = await params;
  const parsed = reactionSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) return jsonError("Invalid reaction.");
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      ...publishedPostVisibilityWhere(user, { moderatorOverride: true }),
    },
    select: { id: true },
  });
  if (!post) return jsonError("Post not found.", 404);

  await prisma.reaction.deleteMany({
    where: { userId: user.id, postId, type: parsed.data.type },
  });
  return new Response(null, { status: 204 });
}
