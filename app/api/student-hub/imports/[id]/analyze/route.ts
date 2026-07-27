import { NextRequest } from "next/server";
import { logServerError, logServerEvent } from "@/lib/logger";
import {
  enqueueNotificationJob,
  processNotificationJobNow,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import {
  getScheduleAnalysisProvider,
  ScheduleAnalysisError,
} from "@/lib/schedule-ai";
import { validateExtractedSchedule } from "@/lib/schedule-validation";
import {
  parseScheduleForPersistence,
  ScheduleImportStateError,
} from "@/lib/schedule-import";
import { getCurrentUser } from "@/lib/server-auth";
import { normalizeExtractedSchedule } from "@/lib/student-schedule";

export const maxDuration = 300;

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
    !(await rateLimit(`schedule-analysis:${user.id}`, 10, 24 * 60 * 60_000))
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
    totalBytes: scheduleImport.files.reduce(
      (total, file) => total + file.mediaAsset.sizeBytes,
      0,
    ),
    mimeTypes: scheduleImport.files
      .map(
        (file) => file.mediaAsset.detectedMime ?? file.mediaAsset.declaredMime,
      )
      .join(","),
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
      processingStage: "FILE_VALIDATION",
      processingDiagnostics: undefined,
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
    if (!configuration || configuration.periods.length === 0) {
      throw new ScheduleAnalysisError(
        "PERIOD_CONFIG_MISSING",
        "The class-period configuration for this university is missing. Ask an administrator to configure the timetable periods before retrying.",
        422,
        false,
      );
    }
    await prisma.scheduleImport.update({
      where: { id },
      data: { processingStage: "TEXT_EXTRACTION" },
    });
    const analysis = await getScheduleAnalysisProvider().analyze(
      scheduleImport.files.map(({ mediaAsset }) => mediaAsset),
      {
        university: scheduleImport.university?.name ?? "Unknown university",
        campus: scheduleImport.campus?.name,
        term: scheduleImport.academicTerm?.name,
        timezone: configuration.timezone,
        periods: configuration.periods,
      },
    );
    await prisma.scheduleImport.update({
      where: { id },
      data: { processingStage: "STRUCTURE_VALIDATION" },
    });
    const validated = validateExtractedSchedule(analysis.extraction);
    const normalized = normalizeExtractedSchedule(
      validated.schedule,
      configuration.periods,
    );
    const reviewCount = normalized.courses.filter(
      (course) => course.uncertainFields.length > 0 || course.confidence < 0.75,
    ).length;
    const persistable = parseScheduleForPersistence(normalized);
    logServerEvent("student-hub.schedule-analysis.validation.completed", {
      importId: id,
      courseCount: normalized.courses.length,
      reviewCount,
      readyForConfirmation: persistable.success,
    });

    await prisma.$transaction([
      prisma.scheduleImportResult.upsert({
        where: { importId: id },
        create: {
          importId: id,
          extractedJson: normalized,
          warnings: normalized.warnings,
          courseCount: normalized.courses.length,
          reviewCount,
          diagnostics: {
            documents: analysis.diagnostics,
            validation: validated.diagnostics,
          },
        },
        update: {
          extractedJson: normalized,
          warnings: normalized.warnings,
          courseCount: normalized.courses.length,
          reviewCount,
          diagnostics: {
            documents: analysis.diagnostics,
            validation: validated.diagnostics,
          },
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
          processingStage: "REVIEW",
          processingDiagnostics: {
            documents: analysis.diagnostics,
            validation: validated.diagnostics,
          },
        },
      }),
    ]);
    const reviewJob = await enqueueNotificationJob({
      recipientId: user.id,
      type: "ACADEMIC",
      templateKey: "ACADEMIC_IMPORT_READY",
      data: { courseCount: normalized.courses.length },
      href: "/student-hub/tools",
      dedupeKey: `academic-import-ready:${id}`,
    });
    if (reviewJob?.id) {
      await processNotificationJobNow(reviewJob.id).catch(() => null);
    }
    logServerEvent("student-hub.schedule-analysis.review-required", {
      importId: id,
      courseCount: normalized.courses.length,
      reviewCount,
      validationIssueCount: persistable.success
        ? 0
        : persistable.error.issues.length,
      explicitConfirmationRequired: true,
    });
    return Response.json({
      importId: id,
      result: normalized,
      reviewCount,
      saved: false,
      readyForConfirmation: persistable.success,
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
        processingStage: "FAILED",
        processingDiagnostics: failure
          ? { code: failure.code, retryable: failure.retryable }
          : { code: "ANALYSIS_FAILED", retryable: false },
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
