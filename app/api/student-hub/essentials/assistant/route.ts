import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import {
  askStudyAssistant,
  isStudyAssistantConfigured,
  STUDY_ASSISTANT_ACTIONS,
} from "@/lib/study-assistant";
import { StudyEssentialError } from "@/lib/study-essentials";
import { ownsEssential } from "@/lib/study-workspace";

const assistantSchema = z.object({
  slug: z.string().trim().min(1).max(180),
  chapterId: z.string().cuid().optional().nullable(),
  passage: z.string().trim().min(20).max(6000),
  action: z.enum(
    STUDY_ASSISTANT_ACTIONS.map(({ key }) => key) as [string, ...string[]],
  ),
});

/** Tells the reader whether to offer the assistant at all. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  return Response.json({ ok: true, configured: isStudyAssistantConfigured() });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = assistantSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    // The assistant only ever reads resources the member actually owns, and
    // the titles it is given come from the database rather than the request.
    const essential = await prisma.studyEssential.findFirst({
      where: { slug: parsed.data.slug, status: "PUBLISHED" },
      select: { id: true, title: true },
    });
    if (!essential) return jsonError("Unknown resource.", 404);
    if (!(await ownsEssential(user.id, essential.id))) {
      return jsonError("This resource is not in your library.", 403);
    }

    let chapterTitle: string | null = null;
    if (parsed.data.chapterId) {
      const chapter = await prisma.studyEssentialChapter.findFirst({
        where: { id: parsed.data.chapterId, essentialId: essential.id },
        select: { title: true },
      });
      chapterTitle = chapter?.title ?? null;
    }

    const result = await askStudyAssistant({
      action: parsed.data.action as never,
      passage: parsed.data.passage,
      resourceTitle: essential.title,
      chapterTitle,
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("studyAssistant.ask", error);
  }
}
