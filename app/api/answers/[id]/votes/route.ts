import { NextRequest } from "next/server";
import { publishedAnswerWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: answerId } = await params;
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, ...publishedAnswerWhere },
    select: { id: true },
  });
  if (!answer) return jsonError("Answer not found.", 404);

  const vote = await prisma.answerVote.upsert({
    where: { answerId_userId: { answerId, userId: user.id } },
    create: { answerId, userId: user.id },
    update: { helpful: true },
    select: { id: true },
  });
  return Response.json({ helpful: Boolean(vote.id) });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: answerId } = await params;
  const answer = await prisma.answer.findFirst({
    where: { id: answerId, ...publishedAnswerWhere },
    select: { id: true },
  });
  if (!answer) return jsonError("Answer not found.", 404);

  await prisma.answerVote.deleteMany({ where: { answerId, userId: user.id } });
  return new Response(null, { status: 204 });
}
