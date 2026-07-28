import { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import { logServerError, logServerEvent } from "@/lib/logger";
import { removeOwnedMedia } from "@/lib/media";
import {
  analyzeUniversityPeriodStructure,
  PeriodStructureAnalysisError,
} from "@/lib/period-configuration-ai";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";

export const maxDuration = 300;

const requestSchema = z.object({
  universityId: z.string().cuid(),
  campusId: z.string().cuid().nullable().optional(),
  mediaId: z.string().cuid(),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("STUDENT_HUB_CONFIG_MANAGE");
  if (!auth.authorized) return auth.error;
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid period extraction request.",
      },
      { status: 400 },
    );
  }

  let cleanupMediaId: string | null = null;
  try {
    const [university, media] = await Promise.all([
      prisma.university.findFirst({
        where: { id: parsed.data.universityId, isActive: true },
        select: {
          id: true,
          name: true,
          campuses: {
            where: parsed.data.campusId
              ? { id: parsed.data.campusId, isActive: true }
              : { id: "__none__" },
            select: { id: true, name: true },
          },
        },
      }),
      prisma.mediaAsset.findFirst({
        where: {
          id: parsed.data.mediaId,
          ownerId: auth.user.id,
          purpose: "SCHEDULE_IMPORT",
          status: "ACTIVE",
        },
        select: {
          id: true,
          objectKey: true,
          storageProvider: true,
          detectedMime: true,
          originalFileName: true,
          sizeBytes: true,
        },
      }),
    ]);
    cleanupMediaId = media?.id ?? null;
    if (!university) {
      return adminJson({ error: "University not found." }, { status: 404 });
    }
    if (parsed.data.campusId && university.campuses.length === 0) {
      return adminJson(
        { error: "Campus does not belong to this university." },
        { status: 400 },
      );
    }
    if (!media) {
      return adminJson(
        { error: "The uploaded official timetable is unavailable." },
        { status: 404 },
      );
    }
    if (
      !(
        await rateLimit(
          `admin-period-extraction:${auth.user.id}`,
          20,
          24 * 60 * 60_000,
        )
      ).allowed
    ) {
      return adminJson(
        { error: "Daily period extraction limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }
    logServerEvent("admin.student-hub.period-import.started", {
      universityId: university.id,
      campusId: parsed.data.campusId ?? null,
      mimeType: media.detectedMime,
      sizeBytes: media.sizeBytes,
    });
    const result = await analyzeUniversityPeriodStructure({
      file: media,
      university: university.name,
      campus: university.campuses[0]?.name ?? null,
    });
    return adminJson({ result });
  } catch (error) {
    if (error instanceof PeriodStructureAnalysisError) {
      logServerError("admin.student-hub.period-import.rejected", error, {
        code: error.code,
        retryable: error.retryable,
      });
      return adminJson(
        {
          error: error.userMessage,
          code: error.code,
          retryable: error.retryable,
        },
        { status: error.status },
      );
    }
    return adminInternalError("admin.student-hub.period-import", error);
  } finally {
    if (cleanupMediaId) {
      await removeOwnedMedia(
        auth.user,
        cleanupMediaId,
        getRequestMeta(request),
      ).catch((cleanupError) =>
        logServerError(
          "admin.student-hub.period-import.cleanup.failed",
          cleanupError,
          { mediaId: cleanupMediaId },
        ),
      );
    }
  }
}
