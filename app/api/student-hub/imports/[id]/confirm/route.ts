import { NextRequest } from "next/server";
import { scheduleImportConfirmSchema } from "@/features/student-hub/schemas";
import { writeAuditLogWithClient } from "@/lib/audit";
import { removeOwnedMedia } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
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
  const parsed = scheduleImportConfirmSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid timetable.");
  const id = (await params).id;
  try {
    const scheduleImport = await prisma.scheduleImport.findFirst({
      where: { id, ownerId: user.id, status: "REVIEW_REQUIRED" },
      include: { files: true },
    });
    if (!scheduleImport) return jsonError("Reviewable import not found.", 404);
    const configuration = await prisma.universityPeriodConfiguration.findFirst({
      where: {
        universityId: scheduleImport.universityId ?? "",
        isActive: true,
        isDefault: true,
      },
      include: { periods: { orderBy: { displayOrder: "asc" } } },
    });
    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.studentSchedule.create({
        data: {
          ownerId: user.id,
          universityId: scheduleImport.universityId,
          campusId: scheduleImport.campusId,
          academicTermId: scheduleImport.academicTermId,
          title: parsed.data.title,
          timezone: configuration?.timezone ?? "Asia/Shanghai",
          periodConfigurationSnapshot: configuration
            ? {
                id: configuration.id,
                version: configuration.version,
                periods: configuration.periods.map((period) => ({
                  periodNumber: period.periodNumber,
                  label: period.label,
                  startTime: period.startTime,
                  endTime: period.endTime,
                  displayOrder: period.displayOrder,
                  part: period.part,
                  isBreak: period.isBreak,
                  isActive: period.isActive,
                })),
              }
            : undefined,
          confirmedAt: new Date(),
          courses: {
            create: parsed.data.courses.map((course) => ({
              ...course,
              specificDate: course.specificDate
                ? new Date(`${course.specificDate}T00:00:00.000Z`)
                : null,
            })),
          },
        },
        include: { courses: true },
      });
      await tx.scheduleImport.update({
        where: { id },
        data: { status: "CONFIRMED", scheduleId: created.id },
      });
      await writeAuditLogWithClient(tx, {
        actorId: user.id,
        action: "STUDENT_SCHEDULE_CONFIRMED",
        entityType: "StudentSchedule",
        entityId: created.id,
        newValue: { importId: id, courseCount: created.courses.length },
        ...getRequestMeta(request),
      });
      return created;
    });
    if (!scheduleImport.retainSource) {
      for (const file of scheduleImport.files) {
        await removeOwnedMedia(
          user,
          file.mediaAssetId,
          getRequestMeta(request),
        ).catch(() => null);
        await prisma.scheduleImportFile.update({
          where: { id: file.id },
          data: { deletedAt: new Date() },
        });
      }
    }
    return Response.json(
      { schedule, conflicts: findScheduleConflicts(schedule.courses) },
      { status: 201 },
    );
  } catch (error) {
    return internalApiError("student-hub.import.confirm", error);
  }
}
