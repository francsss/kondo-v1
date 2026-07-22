import { NextRequest } from "next/server";
import { logServerError, logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import {
  getScheduleAnalysisProvider,
  ScheduleAnalysisError,
} from "@/lib/schedule-ai";
import {
  cleanupScheduleImportSources,
  parseScheduleForPersistence,
  saveScheduleImport,
  ScheduleImportStateError,
} from "@/lib/schedule-import";
import { getCurrentUser } from "@/lib/server-auth";
import { normalizeExtractedSchedule } from "@/lib/student-schedule";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const id = (await params).id;
  logServerEvent("student-hub.schedule-analysis.request.received", {
    importId: id,
  });
  if (
    !(await rateLimit(`schedule-analysis:${user.id}`, 5, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError(
      "Daily timetable analysis limit reached. Try again tomorrow.",
      429,
    );
  }
  const scheduleImport = await prisma.scheduleImport.findFirst({
    where: { id, ownerId: user.id },
    include: {
      university: { select: { name: true } },
      campus: { select: { name: true } },
      academicTerm: { select: { name: true } },
      files: { include: { mediaAsset: true } },
    },
  });
  if (!scheduleImport) return jsonError("Import not found.", 404);
  logServerEvent("student-hub.schedule-analysis.files.received", {
    importId: id,
    fileCount: scheduleImport.files.length,
  });
  if (
    !["UPLOADED", "FAILED", "REVIEW_REQUIRED"].includes(scheduleImport.status)
  ) {
    return jsonError(
      "This import cannot be analyzed in its current state.",
      409,
    );
  }
  const claimed = await prisma.scheduleImport.updateMany({
    where: { id, ownerId: user.id, status: scheduleImport.status },
    data: {
      status: "ANALYZING",
      attemptCount: { increment: 1 },
      errorCode: null,
      errorMessage: null,
    },
  });
  if (claimed.count !== 1) return jsonError("Analysis already started.", 409);
  logServerEvent("student-hub.schedule-analysis.started", {
    importId: id,
    attempt: scheduleImport.attemptCount + 1,
    fileCount: scheduleImport.files.length,
  });

  try {
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
          where: { isActive: true, isBreak: false },
          orderBy: { displayOrder: "asc" },
        },
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    const analysis = await getScheduleAnalysisProvider().analyze(
      scheduleImport.files.map(({ mediaAsset }) => mediaAsset),
      {
        university: scheduleImport.university?.name ?? "Unknown university",
        campus: scheduleImport.campus?.name,
        term: scheduleImport.academicTerm?.name,
        timezone: configuration?.timezone ?? "Asia/Shanghai",
        periods: configuration?.periods ?? [],
      },
    );
    const normalized = normalizeExtractedSchedule(
      analysis.extraction,
      configuration?.periods ?? [],
    );
    const reviewCount = normalized.courses.filter(
      (course) => course.uncertainFields.length > 0 || course.confidence < 0.75,
    ).length;
    const persistable = parseScheduleForPersistence(normalized);
    logServerEvent("student-hub.schedule-analysis.validation.completed", {
      importId: id,
      courseCount: normalized.courses.length,
      reviewCount,
      canSave: persistable.success,
    });

    if (persistable.success) {
      const saved = await saveScheduleImport({
        importId: id,
        ownerId: user.id,
        expectedStatus: "ANALYZING",
        title: persistable.data.title,
        courses: persistable.data.courses,
        requestMeta: getRequestMeta(request),
        analysis: {
          provider: analysis.provider,
          model: analysis.model,
          inputTokens: analysis.inputTokens,
          outputTokens: analysis.outputTokens,
          normalized,
          reviewCount,
        },
      });
      await cleanupScheduleImportSources({
        actor: user,
        importId: id,
        files: saved.files,
        retainSource: saved.retainSource,
        requestMeta: getRequestMeta(request),
      });
      logServerEvent("student-hub.schedule-analysis.completed", {
        importId: id,
        scheduleId: saved.schedule.id,
        courseCount: saved.schedule.courses.length,
      });
      return Response.json(
        {
          importId: id,
          schedule: saved.schedule,
          conflicts: saved.conflicts,
          reviewCount,
          saved: true,
        },
        { status: 201 },
      );
    }

    await prisma.$transaction([
      prisma.scheduleImportResult.upsert({
        where: { importId: id },
        create: {
          importId: id,
          extractedJson: normalized,
          warnings: normalized.warnings,
          courseCount: normalized.courses.length,
          reviewCount,
        },
        update: {
          extractedJson: normalized,
          warnings: normalized.warnings,
          courseCount: normalized.courses.length,
          reviewCount,
        },
      }),
      prisma.scheduleImport.update({
        where: { id },
        data: {
          status: "REVIEW_REQUIRED",
          provider: analysis.provider,
          model: analysis.model,
          inputTokens: analysis.inputTokens,
          outputTokens: analysis.outputTokens,
        },
      }),
    ]);
    logServerEvent("student-hub.schedule-analysis.review-required", {
      importId: id,
      courseCount: normalized.courses.length,
      reviewCount,
      validationIssueCount: persistable.error.issues.length,
    });
    return Response.json({
      importId: id,
      result: normalized,
      reviewCount,
      saved: false,
    });
  } catch (error) {
    const failure =
      error instanceof ScheduleAnalysisError
        ? error
        : error instanceof ScheduleImportStateError
          ? new ScheduleAnalysisError(
              "AI_INVALID_RESPONSE",
              error.message,
              error.status,
              false,
            )
          : null;
    await prisma.scheduleImport.updateMany({
      where: { id, ownerId: user.id },
      data: {
        status: "FAILED",
        errorCode: failure?.code ?? "ANALYSIS_FAILED",
        errorMessage:
          failure?.userMessage ?? "The timetable could not be analyzed.",
      },
    });
    logServerError("student-hub.schedule-analysis.request.failed", error, {
      importId: id,
      errorCode: failure?.code ?? "ANALYSIS_FAILED",
      retryable: failure?.retryable ?? false,
    });
    if (failure) {
      return Response.json(
        {
          error: failure.userMessage,
          code: failure.code,
          retryable: failure.retryable,
        },
        { status: failure.status },
      );
    }
    return internalApiError("student-hub.import.analyze", error);
  }
}
