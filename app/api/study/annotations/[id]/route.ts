import { NextRequest } from "next/server";
import { z } from "zod";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import {
  deleteAnnotation,
  deleteBookmark,
  updateAnnotation,
} from "@/lib/study-reading";

/**
 * Editing and removing one annotation.
 *
 * Scoped by the session's user id inside the query rather than fetched and
 * compared afterwards, so another member's note is simply not found. There is
 * no path here that reads a row before deciding whether the caller owns it.
 */

export const dynamic = "force-dynamic";

const patchSchema = z.object({ body: z.string().trim().max(4000) });
const deleteSchema = z.object({
  kind: z.enum(["annotation", "bookmark"]).default("annotation"),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid note.");

  try {
    return Response.json(
      await updateAnnotation({
        userId: user.id,
        noteId: (await params).id,
        body: parsed.data.body,
      }),
    );
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.annotations.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const kind =
    deleteSchema.safeParse({
      kind: new URL(request.url).searchParams.get("kind") ?? undefined,
    }).data?.kind ?? "annotation";

  try {
    const id = (await params).id;
    return Response.json(
      kind === "bookmark"
        ? await deleteBookmark(user.id, id)
        : await deleteAnnotation(user.id, id),
    );
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("study.annotations.delete", error);
  }
}
