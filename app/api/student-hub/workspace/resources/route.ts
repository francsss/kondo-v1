import { NextRequest } from "next/server";
import { z } from "zod";
import { internalApiError, jsonError } from "@/lib/request";
import { hasTrustedOrigin } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StudyEssentialError } from "@/lib/study-essentials";
import {
  linkCourseResource,
  listLinkableResources,
  unlinkCourseResource,
} from "@/lib/study-workspace";

/**
 * Attaching an owned resource to a course.
 *
 * This writes `CourseResource` only. Ownership stays where it already lives —
 * a PAID `StudyEssentialOrder` — and both the link and the list re-check it, so
 * no route here can grant access to a book the student has not acquired.
 */

const linkSchema = z.object({
  courseId: z.string().cuid(),
  essentialId: z.string().cuid(),
});

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const courseId = request.nextUrl.searchParams.get("courseId");
  if (!courseId) return jsonError("A course is required.");
  try {
    return Response.json({
      resources: await listLinkableResources(user.id, courseId),
    });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("workspace.resources.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid link.", 422);
  }
  try {
    const link = await linkCourseResource({ userId: user.id, ...parsed.data });
    return Response.json({ link }, { status: 201 });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("workspace.resources.link", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const linkId = request.nextUrl.searchParams.get("linkId");
  if (!linkId) return jsonError("A link is required.");
  try {
    await unlinkCourseResource(user.id, linkId);
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof StudyEssentialError)
      return jsonError(error.message, error.status);
    return internalApiError("workspace.resources.unlink", error);
  }
}
