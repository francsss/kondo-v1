import { NextRequest } from "next/server";
import { academicTaskUpdateSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

async function ownedTask(ownerId: string, id: string) {
  return prisma.academicTask.findFirst({ where: { id, ownerId } });
}

async function validateLinks(input: {
  ownerId: string;
  scheduleId?: string | null;
  courseId?: string | null;
}) {
  const schedule = input.scheduleId
    ? await prisma.studentSchedule.findFirst({
        where: { id: input.scheduleId, ownerId: input.ownerId, isActive: true },
        select: { id: true },
      })
    : null;
  if (input.scheduleId && !schedule) return "Schedule not found.";

  const course = input.courseId
    ? await prisma.scheduleCourse.findFirst({
        where: { id: input.courseId, schedule: { ownerId: input.ownerId } },
        select: { scheduleId: true },
      })
    : null;
  if (input.courseId && !course) return "Course not found.";
  if (course && input.scheduleId && course.scheduleId !== input.scheduleId) {
    return "The selected course does not belong to this schedule.";
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = academicTaskUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid academic task.",
      422,
    );
  }

  const { id } = await params;
  try {
    const existing = await ownedTask(user.id, id);
    if (!existing) return jsonError("Task not found.", 404);
    const linkError = await validateLinks({
      ownerId: user.id,
      scheduleId: parsed.data.scheduleId,
      courseId: parsed.data.courseId,
    });
    if (linkError) return jsonError(linkError, 404);

    const task = await prisma.academicTask.update({
      where: { id },
      data: {
        ...parsed.data,
        ...(parsed.data.dueAt !== undefined
          ? {
              dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
            }
          : {}),
        ...(parsed.data.reminderAt !== undefined
          ? {
              reminderAt: parsed.data.reminderAt
                ? new Date(parsed.data.reminderAt)
                : null,
            }
          : {}),
        ...(parsed.data.status
          ? {
              completedAt:
                parsed.data.status === "COMPLETED" ? new Date() : null,
            }
          : {}),
      },
      include: {
        course: { select: { id: true, courseName: true, color: true } },
      },
    });
    return Response.json({ task });
  } catch (error) {
    return internalApiError("student-hub.task.update", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id } = await params;
  try {
    if (!(await ownedTask(user.id, id)))
      return jsonError("Task not found.", 404);
    await prisma.academicTask.delete({ where: { id } });
    return Response.json({ deleted: true });
  } catch (error) {
    return internalApiError("student-hub.task.delete", error);
  }
}
