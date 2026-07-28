import { NextRequest } from "next/server";
import { academicTaskInputSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

async function validateTaskLinks(input: {
  ownerId: string;
  scheduleId?: string | null;
  courseId?: string | null;
}) {
  const [schedule, course] = await Promise.all([
    input.scheduleId
      ? prisma.studentSchedule.findFirst({
          where: {
            id: input.scheduleId,
            ownerId: input.ownerId,
            isActive: true,
          },
          select: { id: true },
        })
      : null,
    input.courseId
      ? prisma.scheduleCourse.findFirst({
          where: { id: input.courseId, schedule: { ownerId: input.ownerId } },
          select: { id: true, scheduleId: true },
        })
      : null,
  ]);

  if (input.scheduleId && !schedule) return "Schedule not found.";
  if (input.courseId && !course) return "Course not found.";
  if (course && input.scheduleId && course.scheduleId !== input.scheduleId) {
    return "The selected course does not belong to this schedule.";
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = academicTaskInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid academic task.",
      422,
    );
  }

  try {
    const linkError = await validateTaskLinks({
      ownerId: user.id,
      scheduleId: parsed.data.scheduleId,
      courseId: parsed.data.courseId,
    });
    if (linkError) return jsonError(linkError, 404);

    const scheduleId =
      parsed.data.scheduleId ??
      (parsed.data.courseId
        ? (
            await prisma.scheduleCourse.findUniqueOrThrow({
              where: { id: parsed.data.courseId },
              select: { scheduleId: true },
            })
          ).scheduleId
        : null);
    const task = await prisma.academicTask.create({
      data: {
        ownerId: user.id,
        scheduleId,
        courseId: parsed.data.courseId ?? null,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        kind: parsed.data.kind,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        reminderAt: parsed.data.reminderAt
          ? new Date(parsed.data.reminderAt)
          : null,
        completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
      },
      include: {
        course: { select: { id: true, courseName: true, color: true } },
      },
    });
    return Response.json({ task }, { status: 201 });
  } catch (error) {
    return internalApiError("student-hub.task.create", error);
  }
}
