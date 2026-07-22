import type { Prisma, ScheduleImportStatus } from "@prisma/client";
import { scheduleImportConfirmSchema } from "@/features/student-hub/schemas";
import { writeAuditLogWithClient } from "@/lib/audit";
import { logServerError, logServerEvent } from "@/lib/logger";
import { removeOwnedMedia } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { findScheduleConflicts } from "@/lib/student-schedule";

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type NormalizedSchedule = {
  title: string;
  warnings: string[];
  courses: Array<Record<string, unknown>>;
};

type AnalysisMetadata = {
  provider: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  normalized: NormalizedSchedule;
  reviewCount: number;
};

export class ScheduleImportStateError extends Error {
  constructor(
    message: string,
    public readonly status = 409,
  ) {
    super(message);
    this.name = "ScheduleImportStateError";
  }
}

export function parseScheduleForPersistence(normalized: NormalizedSchedule) {
  return scheduleImportConfirmSchema.safeParse({
    title: normalized.title,
    courses: normalized.courses.map((course) => {
      const persistable = { ...course };
      delete persistable.uncertainFields;
      return persistable;
    }),
  });
}

export async function saveScheduleImport(input: {
  importId: string;
  ownerId: string;
  expectedStatus: Extract<
    ScheduleImportStatus,
    "ANALYZING" | "REVIEW_REQUIRED"
  >;
  title: string;
  courses: Array<Record<string, unknown>>;
  requestMeta?: RequestMeta;
  analysis?: AnalysisMetadata;
}) {
  const parsed = scheduleImportConfirmSchema.safeParse({
    title: input.title,
    courses: input.courses,
  });
  if (!parsed.success) {
    throw new ScheduleImportStateError(
      parsed.error.issues[0]?.message ?? "Invalid timetable.",
      422,
    );
  }

  const scheduleImport = await prisma.scheduleImport.findFirst({
    where: {
      id: input.importId,
      ownerId: input.ownerId,
      status: input.expectedStatus,
    },
    include: { files: true },
  });
  if (!scheduleImport) {
    throw new ScheduleImportStateError(
      "This timetable import is no longer ready to be saved.",
      409,
    );
  }

  const configuration = await prisma.universityPeriodConfiguration.findFirst({
    where: {
      universityId: scheduleImport.universityId ?? "",
      isActive: true,
      OR: scheduleImport.campusId
        ? [{ campusId: scheduleImport.campusId }, { campusId: null }]
        : [{ campusId: null }],
    },
    include: {
      periods: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      },
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  logServerEvent("student-hub.schedule.save.started", {
    importId: input.importId,
    courseCount: parsed.data.courses.length,
    source: input.analysis ? "analysis" : "review",
  });

  const schedule = await prisma.$transaction(async (tx) => {
    if (input.analysis) {
      await tx.scheduleImportResult.upsert({
        where: { importId: input.importId },
        create: {
          importId: input.importId,
          extractedJson: input.analysis.normalized as Prisma.InputJsonValue,
          warnings: input.analysis.normalized.warnings,
          courseCount: input.analysis.normalized.courses.length,
          reviewCount: input.analysis.reviewCount,
        },
        update: {
          extractedJson: input.analysis.normalized as Prisma.InputJsonValue,
          warnings: input.analysis.normalized.warnings,
          courseCount: input.analysis.normalized.courses.length,
          reviewCount: input.analysis.reviewCount,
        },
      });
    }

    const created = await tx.studentSchedule.create({
      data: {
        ownerId: input.ownerId,
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

    const claimed = await tx.scheduleImport.updateMany({
      where: {
        id: input.importId,
        ownerId: input.ownerId,
        status: input.expectedStatus,
      },
      data: {
        status: "CONFIRMED",
        scheduleId: created.id,
        errorCode: null,
        errorMessage: null,
        ...(input.analysis
          ? {
              provider: input.analysis.provider,
              model: input.analysis.model,
              inputTokens: input.analysis.inputTokens,
              outputTokens: input.analysis.outputTokens,
            }
          : {}),
      },
    });
    if (claimed.count !== 1) {
      throw new ScheduleImportStateError(
        "This timetable import was already processed.",
      );
    }

    await writeAuditLogWithClient(tx, {
      actorId: input.ownerId,
      action: "STUDENT_SCHEDULE_CONFIRMED",
      entityType: "StudentSchedule",
      entityId: created.id,
      newValue: {
        importId: input.importId,
        courseCount: created.courses.length,
        source: input.analysis ? "analysis" : "review",
      },
      ...input.requestMeta,
    });
    return created;
  });

  logServerEvent("student-hub.schedule.save.completed", {
    importId: input.importId,
    scheduleId: schedule.id,
    courseCount: schedule.courses.length,
  });

  return {
    schedule,
    conflicts: findScheduleConflicts(schedule.courses),
    files: scheduleImport.files,
    retainSource: scheduleImport.retainSource,
  };
}

export async function cleanupScheduleImportSources(input: {
  actor: { id: string; role: string };
  importId: string;
  files: Array<{ id: string; mediaAssetId: string }>;
  retainSource: boolean;
  requestMeta?: RequestMeta;
}) {
  if (input.retainSource) return;
  logServerEvent("student-hub.schedule.sources.cleanup.started", {
    importId: input.importId,
    fileCount: input.files.length,
  });
  for (const file of input.files) {
    try {
      await removeOwnedMedia(input.actor, file.mediaAssetId, input.requestMeta);
      await prisma.scheduleImportFile.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      logServerError("student-hub.schedule.sources.cleanup.failed", error, {
        importId: input.importId,
      });
    }
  }
  logServerEvent("student-hub.schedule.sources.cleanup.completed", {
    importId: input.importId,
    fileCount: input.files.length,
  });
}
