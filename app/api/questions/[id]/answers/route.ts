import { NextRequest } from "next/server";
import { writeAuditLogWithClient } from "@/lib/audit";
import { publishedQuestionWhere } from "@/lib/content-visibility";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createAnswerSchema } from "@/lib/validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`answer:${user.id}`, 20, 60 * 60_000).allowed) {
    return jsonError("Answer limit reached. Try again later.", 429);
  }
  const parsed = createAnswerSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid answer.");
  }
  const { id: questionId } = await params;
  const question = await prisma.question.findFirst({
    where: { id: questionId, ...publishedQuestionWhere },
    select: { id: true, authorId: true, slug: true },
  });
  if (!question) {
    return jsonError("Question not found.", 404);
  }

  const answer = await prisma.$transaction(async (tx) => {
    const created = await tx.answer.create({
      data: { questionId, authorId: user.id, body: parsed.data.body },
      select: { id: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: user.id,
      action: "ANSWER_CREATED",
      entityType: "Answer",
      entityId: created.id,
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: question.authorId,
      actorId: user.id,
      type: "REPLY",
      templateKey: "QNA_REPLY",
      data: {
        actorName: `${user.firstName} ${user.lastName}`,
        preview: parsed.data.body.slice(0, 280),
      },
      href: `/help/${question.slug}`,
      dedupeKey: `answer:${created.id}`,
    });
    return created;
  });
  return Response.json({ answer: { id: answer.id } }, { status: 201 });
}
