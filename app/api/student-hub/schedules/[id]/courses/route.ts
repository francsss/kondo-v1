import { NextRequest } from "next/server";
import { scheduleCourseInputSchema } from "@/features/student-hub/schemas";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { findScheduleConflicts } from "@/lib/student-schedule";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = scheduleCourseInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid course.");
  const scheduleId = (await params).id;
  try {
    const schedule = await prisma.studentSchedule.findFirst({
      where: { id: scheduleId, ownerId: user.id },
    });
    if (!schedule) return jsonError("Timetable not found.", 404);
    const course = await prisma.scheduleCourse.create({
      data: {
        scheduleId,
        ...parsed.data,
        specificDate: parsed.data.specificDate
          ? new Date(`${parsed.data.specificDate}T00:00:00.000Z`)
          : null,
      },
    });
    const courses = await prisma.scheduleCourse.findMany({
      where: { scheduleId },
    });
    return Response.json(
      { course, conflicts: findScheduleConflicts(courses) },
      { status: 201 },
    );
  } catch (error) {
    return internalApiError("student-hub.course.create", error);
  }
}
