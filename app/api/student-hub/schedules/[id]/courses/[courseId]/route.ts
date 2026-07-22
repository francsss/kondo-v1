import { NextRequest } from "next/server";
import { scheduleCourseInputSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

async function ownedCourse(
  userId: string,
  scheduleId: string,
  courseId: string,
) {
  return prisma.scheduleCourse.findFirst({
    where: { id: courseId, scheduleId, schedule: { ownerId: userId } },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  // Course edits submit the complete record. Requiring the full shape keeps the
  // time-range and recurrence validation identical for create and update.
  const parsed = scheduleCourseInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid course.");
  const { id, courseId } = await params;
  try {
    if (!(await ownedCourse(user.id, id, courseId)))
      return jsonError("Course not found.", 404);
    const course = await prisma.scheduleCourse.update({
      where: { id: courseId },
      data: {
        ...parsed.data,
        ...(parsed.data.specificDate !== undefined
          ? {
              specificDate: parsed.data.specificDate
                ? new Date(`${parsed.data.specificDate}T00:00:00.000Z`)
                : null,
            }
          : {}),
      },
    });
    return Response.json({ course });
  } catch (error) {
    return internalApiError("student-hub.course.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id, courseId } = await params;
  try {
    if (!(await ownedCourse(user.id, id, courseId)))
      return jsonError("Course not found.", 404);
    await prisma.scheduleCourse.delete({ where: { id: courseId } });
    return Response.json({ deleted: true });
  } catch (error) {
    return internalApiError("student-hub.course.delete", error);
  }
}
