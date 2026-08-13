import { NextRequest } from "next/server";
import { z } from "zod";
import { MediaError } from "@/lib/media";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import {
  createCourseCapture,
  deleteCourseCapture,
} from "@/lib/study-workspace";

/**
 * What a student captured during a class.
 *
 * The bytes never pass through here. A photo, a handout or a voice note is
 * uploaded through `/api/media/uploads`, which is where size, MIME and content
 * checks already live; this route only records that the resulting asset
 * belongs to a course, and only for a course the caller owns.
 */

const captureSchema = z
  .object({
    courseId: z.string().cuid(),
    kind: z.enum(["NOTE", "PHOTO", "DOCUMENT", "VOICE"]),
    body: z.string().trim().max(4000).optional(),
    mediaId: z.string().cuid().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind !== "NOTE" && !value.mediaId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaId"],
        message: "This capture needs a file.",
      });
    }
    if (value.kind === "NOTE" && !value.body) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body"],
        message: "Write something first.",
      });
    }
  });

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`course-capture:${user.id}`, 120, 60 * 60_000)).allowed)
    return jsonError("Too many captures. Try again shortly.", 429);

  const parsed = captureSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid capture.",
      422,
    );
  }
  try {
    const capture = await createCourseCapture({
      userId: user.id,
      ...parsed.data,
    });
    return Response.json({ capture }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyEssentialError || error instanceof MediaError)
      return jsonError(error.message, error.status);
    return internalApiError("workspace.captures.create", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const captureId = request.nextUrl.searchParams.get("captureId");
  if (!captureId) return jsonError("A capture is required.");
  try {
    await deleteCourseCapture(user.id, captureId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("workspace.captures.delete", error);
  }
}
