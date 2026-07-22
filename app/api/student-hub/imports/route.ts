import { NextRequest } from "next/server";
import { writeAuditLogWithClient } from "@/lib/audit";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { scheduleImportCreateSchema } from "@/features/student-hub/schemas";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  logServerEvent("student-hub.schedule-import.request.received");
  const parsed = scheduleImportCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid import.");

  try {
    const { universityId, campusId, academicTermId, mediaIds, retainSource } =
      parsed.data;
    const university = await prisma.university.findFirst({
      where: { id: universityId, isActive: true },
      select: {
        id: true,
        campuses: {
          where: campusId
            ? { id: campusId, isActive: true }
            : { id: "__none__" },
          select: { id: true },
        },
        academicTerms: {
          where: academicTermId
            ? { id: academicTermId, isActive: true }
            : { id: "__none__" },
          select: { id: true },
        },
      },
    });
    if (!university) return jsonError("University not found.", 404);
    if (campusId && university.campuses.length === 0)
      return jsonError("Campus does not belong to this university.");
    if (academicTermId && university.academicTerms.length === 0)
      return jsonError("Semester does not belong to this university.");
    const assets = await prisma.mediaAsset.findMany({
      where: {
        id: { in: mediaIds },
        ownerId: user.id,
        purpose: "SCHEDULE_IMPORT",
        status: "ACTIVE",
      },
      select: { id: true, sizeBytes: true },
    });
    if (assets.length !== mediaIds.length)
      return jsonError("One or more timetable files are unavailable.", 400);
    if (
      assets.reduce((total, asset) => total + asset.sizeBytes, 0) >
      30 * 1024 * 1024
    )
      return jsonError("A timetable import cannot exceed 30 MB in total.", 413);
    logServerEvent("student-hub.schedule-import.files.validated", {
      fileCount: assets.length,
      totalBytes: assets.reduce((total, asset) => total + asset.sizeBytes, 0),
    });

    const scheduleImport = await prisma.$transaction(async (tx) => {
      const created = await tx.scheduleImport.create({
        data: {
          ownerId: user.id,
          universityId,
          campusId: campusId ?? null,
          academicTermId: academicTermId ?? null,
          retainSource,
        },
      });
      for (const mediaId of mediaIds) {
        await attachMediaAsset(tx, {
          ownerId: user.id,
          assetId: mediaId,
          purpose: "SCHEDULE_IMPORT",
          attachmentType: "SCHEDULE_IMPORT",
          attachmentId: created.id,
        });
        await tx.scheduleImportFile.create({
          data: { importId: created.id, mediaAssetId: mediaId },
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: user.id,
        action: "SCHEDULE_IMPORT_CREATED",
        entityType: "ScheduleImport",
        entityId: created.id,
        newValue: {
          universityId,
          campusId,
          academicTermId,
          fileCount: mediaIds.length,
          retainSource,
        },
        ...getRequestMeta(request),
      });
      return created;
    });
    logServerEvent("student-hub.schedule-import.created", {
      importId: scheduleImport.id,
      fileCount: mediaIds.length,
    });
    return Response.json({ import: scheduleImport }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaError)
      return jsonError(error.message, error.status);
    return internalApiError("student-hub.import.create", error);
  }
}
