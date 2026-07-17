import { NextRequest } from "next/server";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createQuestionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`question:${user.id}`, 8, 60 * 60_000).allowed) {
    return jsonError("Question limit reached. Try again later.", 429);
  }
  const parsed = createQuestionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid question.");
  }

  const slug = `${parsed.data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const question = await prisma.question.create({
    data: { ...parsed.data, slug, authorId: user.id },
  });
  await writeAuditLog({
    actorId: user.id,
    action: "QUESTION_CREATED",
    entityType: "Question",
    entityId: question.id,
  });
  return Response.json({ question }, { status: 201 });
}
