import { NextRequest } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import { createStudyNote, deleteStudyNote } from "@/lib/study-workspace";

const noteSchema = z
  .object({
    slug: z.string().trim().min(1).max(180),
    chapterId: z.string().cuid().optional().nullable(),
    highlight: z.string().trim().max(2000).optional().nullable(),
    body: z.string().trim().max(8000).optional().nullable(),
    // Present when the student turned the highlight into a planner task.
    task: z
      .object({
        title: z.string().trim().min(1).max(200),
        dueAt: z.coerce.date().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .refine((data) => Boolean(data.highlight?.trim() || data.body?.trim()), {
    message: "Add a highlight or write a note.",
  });

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = noteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid note.");
  }

  try {
    const note = await createStudyNote({
      userId: user.id,
      essentialSlug: parsed.data.slug,
      chapterId: parsed.data.chapterId,
      highlight: parsed.data.highlight,
      body: parsed.data.body,
      task: parsed.data.task ?? null,
    });
    return Response.json({ ok: true, note });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("studyWorkspace.note.create", error);
  }
}

const deleteSchema = z.object({ id: z.string().cuid() });

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid note.");

  try {
    await deleteStudyNote(user.id, parsed.data.id);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("studyWorkspace.note.delete", error);
  }
}
