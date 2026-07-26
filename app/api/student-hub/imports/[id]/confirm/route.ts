import { NextRequest } from "next/server";
import { scheduleImportConfirmSchema } from "@/features/student-hub/schemas";
import { logServerError, logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import {
  cleanupScheduleImportSources,
  saveScheduleImport,
  ScheduleImportStateError,
} from "@/lib/schedule-import";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = scheduleImportConfirmSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid timetable.");
  const id = (await params).id;
  try {
    await prisma.scheduleImport.updateMany({
      where: {
        id,
        ownerId: user.id,
        status: "REVIEW_REQUIRED",
      },
      data: { processingStage: "GENERATING_SCHEDULE" },
    });
    logServerEvent("student-hub.schedule-import.confirmation.started", {
      importId: id,
      ownerId: user.id,
      courseCount: parsed.data.courses.length,
      stage: 7,
    });
    const saved = await saveScheduleImport({
      importId: id,
      ownerId: user.id,
      expectedStatus: "REVIEW_REQUIRED",
      title: parsed.data.title,
      courses: parsed.data.courses,
      requestMeta: getRequestMeta(request),
    });
    await cleanupScheduleImportSources({
      actor: user,
      importId: id,
      files: saved.files,
      retainSource: saved.retainSource,
      requestMeta: getRequestMeta(request),
    });
    await prisma.scheduleImport.update({
      where: { id },
      data: {
        processingStage: "COMPLETE",
        processingDiagnostics: {
          scheduleId: saved.schedule.id,
          courseCount: saved.schedule.courses.length,
          conflictCount: saved.conflicts.length,
          derivedViews: ["CALENDAR", "COURSE_WORKSPACES", "TODAY"],
          assignmentReminders:
            "Created only when a future structured assignment detector supplies due dates.",
        },
      },
    });
    logServerEvent("student-hub.schedule-import.confirmation.completed", {
      importId: id,
      scheduleId: saved.schedule.id,
      courseCount: saved.schedule.courses.length,
      conflictCount: saved.conflicts.length,
      calendarAndTodayViewsReady: true,
      courseWorkspacesReady: true,
    });
    return Response.json(
      { schedule: saved.schedule, conflicts: saved.conflicts },
      { status: 201 },
    );
  } catch (error) {
    await prisma.scheduleImport
      .updateMany({
        where: { id, ownerId: user.id, status: "REVIEW_REQUIRED" },
        data: { processingStage: "REVIEW" },
      })
      .catch((resetError) =>
        logServerError(
          "student-hub.schedule-import.confirmation.stage-reset.failed",
          resetError,
          { importId: id },
        ),
      );
    if (error instanceof ScheduleImportStateError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("student-hub.import.confirm", error);
  }
}
