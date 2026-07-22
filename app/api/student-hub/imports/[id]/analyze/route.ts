import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getScheduleAnalysisProvider } from "@/lib/schedule-ai";
import { getCurrentUser } from "@/lib/server-auth";
import { normalizeExtractedSchedule } from "@/lib/student-schedule";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`schedule-analysis:${user.id}`, 5, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError(
      "Daily timetable analysis limit reached. Try again tomorrow.",
      429,
    );
  }
  const id = (await params).id;
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
    return Response.json({ importId: id, result: normalized, reviewCount });
  } catch (error) {
    await prisma.scheduleImport.updateMany({
      where: { id, ownerId: user.id },
      data: {
        status: "FAILED",
        errorCode: "ANALYSIS_FAILED",
        errorMessage: "The timetable could not be analyzed.",
      },
    });
    if (
      error instanceof Error &&
      error.message === "Schedule analysis is not configured."
    ) {
      return jsonError("Timetable analysis is not configured yet.", 503);
    }
    return internalApiError("student-hub.import.analyze", error);
  }
}
