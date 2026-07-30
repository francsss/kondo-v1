import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import type {
  MediaAsset,
  MediaPurpose,
  MediaStatus,
  Prisma,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { MediaPolicyError, validateMediaIntent } from "@/lib/media-policy";
import {
  createMediaUploadToken,
  verifyMediaUploadToken,
} from "@/lib/media-token";
import { validateUploadedMedia } from "@/lib/media-validation";
import { prisma } from "@/lib/prisma";
import { getObjectStorage, getObjectStorageForProvider } from "@/lib/storage";

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

type Actor = {
  id: string;
  role: AppRole | string;
};

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type UploadIntentInput = {
  purpose: MediaPurpose;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  altText?: string | null;
  replacesId?: string;
};

type AttachmentInput = {
  attachmentType: string;
  attachmentId: string;
};

export class MediaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "MediaError";
  }
}

function safeOriginalFileName(fileName: string) {
  return basename(fileName)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 255);
}

function buildObjectKey(
  ownerId: string,
  purpose: MediaPurpose,
  extension: string,
) {
  const now = new Date();
  return [
    "media",
    ownerId,
    purpose.toLowerCase().replaceAll("_", "-"),
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${randomUUID()}.${extension}`,
  ].join("/");
}

function publicMediaDto(asset: MediaAsset) {
  return {
    id: asset.id,
    purpose: asset.purpose,
    kind: asset.kind,
    visibility: asset.visibility,
    status: asset.status,
    mimeType: asset.detectedMime,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    altText: asset.altText,
    url: asset.status === "ACTIVE" ? `/api/media/${asset.id}` : null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function adminMediaDto<
  T extends MediaAsset & {
    owner?: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    } | null;
    removedBy?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  },
>(asset: T) {
  return {
    ...publicMediaDto(asset),
    storageProvider: asset.storageProvider,
    scanStatus: asset.scanStatus,
    originalFileName: asset.originalFileName,
    extension: asset.extension,
    declaredMime: asset.declaredMime,
    checksumSha256: asset.checksumSha256,
    uploadExpiresAt: asset.uploadExpiresAt.toISOString(),
    uploadedAt: asset.uploadedAt?.toISOString() ?? null,
    validatedAt: asset.validatedAt?.toISOString() ?? null,
    attachedAt: asset.attachedAt?.toISOString() ?? null,
    attachmentType: asset.attachmentType,
    attachmentId: asset.attachmentId,
    replacesId: asset.replacesId,
    rejectionReason: asset.rejectionReason,
    retainedAt: asset.retainedAt?.toISOString() ?? null,
    retentionReason: asset.retentionReason,
    removedAt: asset.removedAt?.toISOString() ?? null,
    storageDeletePending: asset.storageDeletePending,
    owner: asset.owner
      ? {
          id: asset.owner.id,
          email: asset.owner.email,
          name: `${asset.owner.firstName} ${asset.owner.lastName}`,
        }
      : null,
    removedBy: asset.removedBy
      ? {
          id: asset.removedBy.id,
          name: `${asset.removedBy.firstName} ${asset.removedBy.lastName}`,
        }
      : null,
  };
}

function mediaAuditValue(asset: MediaAsset) {
  return {
    ownerId: asset.ownerId,
    purpose: asset.purpose,
    kind: asset.kind,
    visibility: asset.visibility,
    status: asset.status,
    scanStatus: asset.scanStatus,
    sizeBytes: asset.sizeBytes,
    width: asset.width,
    height: asset.height,
    durationSeconds: asset.durationSeconds,
    attachedAt: asset.attachedAt,
    attachmentType: asset.attachmentType,
    attachmentId: asset.attachmentId,
    replacesId: asset.replacesId,
    removedAt: asset.removedAt,
  };
}

export async function finalizeMediaStorageDeletion(
  asset: Pick<MediaAsset, "id" | "objectKey" | "storageProvider">,
) {
  const retention = await prisma.mediaAsset.findUnique({
    where: { id: asset.id },
    select: { retainedAt: true },
  });
  if (retention?.retainedAt) {
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { storageDeletePending: false },
    });
    return;
  }
  try {
    await getObjectStorageForProvider(asset.storageProvider).delete(
      asset.objectKey,
    );
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { storageDeletePending: false },
    });
  } catch {
    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { storageDeletePending: true },
    });
  }
}

export async function createMediaUploadIntent(
  actor: Actor,
  input: UploadIntentInput,
  meta: RequestMeta = {},
) {
  const validated = validateMediaIntent(input);
  const originalFileName = safeOriginalFileName(input.fileName);
  if (!originalFileName) {
    throw new MediaError("A valid original file name is required.");
  }

  let replacement: MediaAsset | null = null;
  if (input.replacesId) {
    replacement = await prisma.mediaAsset.findUnique({
      where: { id: input.replacesId },
    });
    if (!replacement)
      throw new MediaError("Media to replace was not found.", 404);
    if (replacement.ownerId !== actor.id) {
      throw new MediaError("You do not own this media.", 403);
    }
    if (
      replacement.status !== "ACTIVE" ||
      replacement.purpose !== input.purpose ||
      replacement.kind !== validated.kind
    ) {
      throw new MediaError("This media cannot be replaced.", 409);
    }
  }

  const storage = getObjectStorage();
  const uploadExpiresAt = new Date(Date.now() + UPLOAD_WINDOW_MS);
  const objectKey = buildObjectKey(
    actor.id,
    input.purpose,
    validated.extension,
  );
  const asset = await prisma.$transaction(async (tx) => {
    const created = await tx.mediaAsset.create({
      data: {
        ownerId: actor.id,
        objectKey,
        storageProvider: storage.provider,
        kind: validated.kind,
        purpose: input.purpose,
        visibility: validated.policy.visibility,
        originalFileName,
        extension: validated.extension,
        declaredMime: validated.mimeType,
        sizeBytes: input.sizeBytes,
        altText: validated.altText,
        uploadExpiresAt,
        replacesId: replacement?.id,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "MEDIA_UPLOAD_AUTHORIZED",
      entityType: "MediaAsset",
      entityId: created.id,
      newValue: mediaAuditValue(created),
      ...meta,
    });
    return created;
  });

  try {
    const uploadToken = await createMediaUploadToken({
      assetId: asset.id,
      ownerId: actor.id,
      objectKey,
      mimeType: validated.mimeType,
      sizeBytes: input.sizeBytes,
    });
    const upload = await storage.createUploadTarget({
      assetId: asset.id,
      objectKey,
      contentType: validated.mimeType,
      sizeBytes: input.sizeBytes,
      uploadToken,
      expiresAt: uploadExpiresAt,
    });
    return { media: publicMediaDto(asset), upload };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      const rejected = await tx.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: "REJECTED",
          scanStatus: "ERROR",
          rejectionReason: "Upload target generation failed.",
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "MEDIA_UPLOAD_AUTHORIZATION_FAILED",
        entityType: "MediaAsset",
        entityId: asset.id,
        oldValue: mediaAuditValue(asset),
        newValue: mediaAuditValue(rejected),
        ...meta,
      });
    });
    throw error;
  }
}

export async function receiveLocalMediaUpload(input: {
  assetId: string;
  uploadToken: string | null;
  contentType: string | null;
  contentLength: number | null;
  bytes: Uint8Array;
}) {
  if (!input.uploadToken)
    throw new MediaError("Upload signature required.", 401);
  const signed = await verifyMediaUploadToken(input.uploadToken);
  if (!signed || signed.assetId !== input.assetId) {
    throw new MediaError("Upload signature is invalid or expired.", 401);
  }
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: input.assetId },
  });
  if (!asset) throw new MediaError("Media upload was not found.", 404);
  if (
    asset.storageProvider !== "LOCAL" ||
    asset.status !== "PENDING" ||
    asset.uploadExpiresAt <= new Date() ||
    asset.ownerId !== signed.ownerId ||
    asset.objectKey !== signed.objectKey ||
    asset.declaredMime !== signed.mimeType ||
    asset.sizeBytes !== signed.sizeBytes
  ) {
    throw new MediaError("Media upload is no longer valid.", 409);
  }
  if (
    input.contentType?.toLowerCase() !== asset.declaredMime ||
    input.contentLength !== asset.sizeBytes ||
    input.bytes.byteLength !== asset.sizeBytes
  ) {
    throw new MediaError("Uploaded content does not match its authorization.");
  }
  await getObjectStorageForProvider("LOCAL").write(
    asset.objectKey,
    input.bytes,
    asset.declaredMime,
  );
}

export async function completeMediaUpload(
  actor: Actor,
  assetId: string,
  meta: RequestMeta = {},
) {
  const current = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });
  if (!current) throw new MediaError("Media upload was not found.", 404);
  if (current.ownerId !== actor.id) {
    throw new MediaError("You do not own this media.", 403);
  }
  if (current.status === "ACTIVE") return publicMediaDto(current);
  if (current.status !== "PENDING" || current.uploadExpiresAt <= new Date()) {
    throw new MediaError("Media upload is no longer completable.", 409);
  }

  const claimed = await prisma.mediaAsset.updateMany({
    where: { id: assetId, status: "PENDING" },
    data: { status: "PROCESSING" },
  });
  if (claimed.count !== 1) {
    throw new MediaError("Media upload is already being processed.", 409);
  }

  const storage = getObjectStorageForProvider(current.storageProvider);
  let bytes: Uint8Array;
  try {
    const head = await storage.head(current.objectKey);
    if (
      head.sizeBytes !== current.sizeBytes ||
      (head.contentType &&
        head.contentType.toLowerCase() !== current.declaredMime)
    ) {
      throw new MediaPolicyError(
        "Stored content does not match its upload authorization.",
      );
    }
    bytes = await storage.read(current.objectKey);
  } catch (error) {
    if (!(error instanceof MediaPolicyError)) {
      await prisma.mediaAsset.updateMany({
        where: { id: assetId, status: "PROCESSING" },
        data: { status: "PENDING" },
      });
      throw new MediaError("Uploaded media could not be read.", 409);
    }
    return rejectProcessedMedia(current, error, meta);
  }

  let validation: Awaited<ReturnType<typeof validateUploadedMedia>>;
  try {
    validation = await validateUploadedMedia({
      purpose: current.purpose,
      bytes,
      declaredMime: current.declaredMime,
      extension: current.extension,
      expectedSizeBytes: current.sizeBytes,
    });
  } catch (error) {
    if (error instanceof MediaPolicyError) {
      return rejectProcessedMedia(current, error, meta);
    }
    await prisma.mediaAsset.updateMany({
      where: { id: assetId, status: "PROCESSING" },
      data: { status: "PENDING" },
    });
    throw error;
  }

  let replaced: MediaAsset | null = null;
  try {
    const active = await prisma.$transaction(async (tx) => {
      if (current.replacesId) {
        replaced = await tx.mediaAsset.findUnique({
          where: { id: current.replacesId },
        });
        if (!replaced || replaced.ownerId !== actor.id) {
          throw new MediaError("Replacement media is unavailable.", 409);
        }
        const removed = await tx.mediaAsset.updateMany({
          where: {
            id: replaced.id,
            ownerId: actor.id,
            status: "ACTIVE",
            purpose: current.purpose,
          },
          data: {
            status: "REMOVED",
            removedAt: new Date(),
            removedById: actor.id,
            storageDeletePending: true,
          },
        });
        if (removed.count !== 1) {
          throw new MediaError("Media was already replaced.", 409);
        }
      }

      const updated = await tx.mediaAsset.update({
        where: { id: current.id },
        data: {
          status: "ACTIVE",
          scanStatus: "CLEAN",
          detectedMime: validation.detectedMime,
          checksumSha256: validation.checksumSha256,
          width: validation.width,
          height: validation.height,
          durationSeconds: validation.durationSeconds,
          uploadedAt: new Date(),
          validatedAt: new Date(),
          attachedAt: replaced?.attachedAt ?? null,
          attachmentType: replaced?.attachmentType ?? null,
          attachmentId: replaced?.attachmentId ?? null,
          rejectionReason: null,
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: current.replacesId
          ? "MEDIA_REPLACEMENT_ACTIVATED"
          : "MEDIA_UPLOAD_ACTIVATED",
        entityType: "MediaAsset",
        entityId: updated.id,
        oldValue: mediaAuditValue(current),
        newValue: mediaAuditValue(updated),
        ...meta,
      });
      return updated;
    });

    if (replaced) await finalizeMediaStorageDeletion(replaced);
    return publicMediaDto(active);
  } catch (error) {
    await prisma.mediaAsset.updateMany({
      where: { id: assetId, status: "PROCESSING" },
      data: { status: "PENDING" },
    });
    throw error;
  }
}

async function rejectProcessedMedia(
  asset: MediaAsset,
  error: MediaPolicyError,
  meta: RequestMeta,
): Promise<never> {
  const scanStatus =
    error.message.includes("safety scan") ||
    error.message.includes("scripts, launch actions")
      ? "FLAGGED"
      : "ERROR";
  await prisma.$transaction(async (tx) => {
    const rejected = await tx.mediaAsset.update({
      where: { id: asset.id },
      data: {
        status: "REJECTED",
        scanStatus,
        rejectionReason: error.message.slice(0, 500),
        storageDeletePending: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: asset.ownerId,
      action: "MEDIA_UPLOAD_REJECTED",
      entityType: "MediaAsset",
      entityId: asset.id,
      oldValue: mediaAuditValue(asset),
      newValue: mediaAuditValue(rejected),
      ...meta,
    });
  });
  await finalizeMediaStorageDeletion(asset);
  throw new MediaError(error.message, error.status);
}

export async function updateMediaAltText(
  actor: Actor,
  assetId: string,
  altText: string,
  meta: RequestMeta = {},
) {
  const existing = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });
  if (!existing) throw new MediaError("Media was not found.", 404);
  if (existing.ownerId !== actor.id) {
    throw new MediaError("You do not own this media.", 403);
  }
  if (existing.kind !== "IMAGE" || existing.status !== "ACTIVE") {
    throw new MediaError("Alt text can only be changed on active images.", 409);
  }
  const normalized = altText.trim();
  const updated = await prisma.$transaction(async (tx) => {
    const media = await tx.mediaAsset.update({
      where: { id: assetId },
      data: { altText: normalized },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "MEDIA_ALT_TEXT_UPDATED",
      entityType: "MediaAsset",
      entityId: assetId,
      oldValue: { altText: existing.altText },
      newValue: { altText: normalized },
      ...meta,
    });
    return media;
  });
  return publicMediaDto(updated);
}

export async function removeOwnedMedia(
  actor: Actor,
  assetId: string,
  meta: RequestMeta = {},
) {
  const existing = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });
  if (!existing) throw new MediaError("Media was not found.", 404);
  if (existing.ownerId !== actor.id) {
    throw new MediaError("You do not own this media.", 403);
  }
  if (existing.status === "REMOVED") return { removed: true };
  if (existing.status === "PROCESSING") {
    throw new MediaError("Media is currently being processed.", 409);
  }
  const removed = await markMediaRemoved({
    actor,
    asset: existing,
    action: "MEDIA_REMOVED_BY_OWNER",
    reason: "Removed by owner.",
    meta,
  });
  await finalizeMediaStorageDeletion(removed);
  return { removed: true };
}

async function markMediaRemoved(input: {
  actor: Actor;
  asset: MediaAsset;
  action: string;
  reason: string;
  meta: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const removed = await tx.mediaAsset.update({
      where: { id: input.asset.id },
      data: {
        status: "REMOVED",
        removedAt: new Date(),
        removedById: input.actor.id,
        rejectionReason: input.reason,
        storageDeletePending: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: input.action,
      entityType: "MediaAsset",
      entityId: removed.id,
      oldValue: mediaAuditValue(input.asset),
      newValue: {
        ...mediaAuditValue(removed),
        reason: input.reason,
      },
      ...input.meta,
    });
    return removed;
  });
}

export async function attachMediaAsset(
  tx: Prisma.TransactionClient,
  input: {
    ownerId: string;
    assetId: string;
    purpose: MediaPurpose;
  } & AttachmentInput,
) {
  const media = await tx.mediaAsset.findFirst({
    where: {
      id: input.assetId,
      ownerId: input.ownerId,
      purpose: input.purpose,
      status: "ACTIVE",
      scanStatus: "CLEAN",
    },
  });
  if (!media) {
    throw new MediaError("Active validated media was not found.", 400);
  }
  if (
    media.attachedAt &&
    (media.attachmentType !== input.attachmentType ||
      media.attachmentId !== input.attachmentId)
  ) {
    throw new MediaError("Media is already attached to another record.", 409);
  }
  return tx.mediaAsset.update({
    where: { id: media.id },
    data: {
      attachedAt: media.attachedAt ?? new Date(),
      attachmentType: input.attachmentType,
      attachmentId: input.attachmentId,
    },
  });
}

export async function getMediaForDelivery(
  assetId: string,
  viewer: Actor | null,
) {
  const asset = await prisma.mediaAsset.findUnique({ where: { id: assetId } });
  const retainedAdminAccess = Boolean(
    asset?.retainedAt &&
    asset.scanStatus === "CLEAN" &&
    viewer &&
    hasAdminPermission(viewer.role, "MEDIA_VIEW"),
  );
  if (
    !asset ||
    (asset.status !== "ACTIVE" && !retainedAdminAccess) ||
    asset.scanStatus !== "CLEAN"
  ) {
    throw new MediaError("Media was not found.", 404);
  }

  let publiclyAuthorized = false;
  let authorized =
    asset.visibility === "PUBLIC" || asset.ownerId === viewer?.id;
  if (!authorized && viewer && hasAdminPermission(viewer.role, "MEDIA_VIEW")) {
    authorized = true;
  }
  if (
    !authorized &&
    asset.attachmentType === "USER_AVATAR" &&
    asset.attachmentId
  ) {
    const profile = await prisma.user.findFirst({
      where: {
        id: asset.attachmentId,
        avatarMediaId: asset.id,
        status: "ACTIVE",
      },
      select: { profileAudience: true },
    });
    authorized = Boolean(
      profile &&
      (profile.profileAudience === "PUBLIC" ||
        (profile.profileAudience === "MEMBERS" && viewer)),
    );
  }
  if (
    !authorized &&
    viewer &&
    asset.attachmentType === "CONVERSATION" &&
    asset.attachmentId
  ) {
    authorized = Boolean(
      await prisma.conversationParticipant.findUnique({
        where: {
          conversationId_userId: {
            conversationId: asset.attachmentId,
            userId: viewer.id,
          },
        },
        select: { conversationId: true },
      }),
    );
  }
  if (
    !authorized &&
    (asset.attachmentType === "ORGANIZATION_LOGO" ||
      asset.attachmentType === "ORGANIZATION_COVER") &&
    asset.attachmentId
  ) {
    const organization = await prisma.organization.findUnique({
      where: { id: asset.attachmentId },
      select: {
        lifecycleStatus: true,
        publicProfileStatus: true,
        publicProfileBlockedAt: true,
        memberships: viewer
          ? {
              where: { userId: viewer.id, status: "ACTIVE" },
              select: { userId: true },
              take: 1,
            }
          : false,
      },
    });
    publiclyAuthorized = Boolean(
      organization?.lifecycleStatus === "ACTIVE" &&
      organization.publicProfileStatus === "PUBLISHED" &&
      !organization.publicProfileBlockedAt,
    );
    authorized = Boolean(
      publiclyAuthorized ||
      (organization &&
        "memberships" in organization &&
        organization.memberships.length),
    );
  }
  if (
    !authorized &&
    asset.attachmentType === "ORGANIZATION_GALLERY" &&
    asset.attachmentId
  ) {
    const gallery = await prisma.organizationMedia.findFirst({
      where: {
        mediaId: asset.id,
        organizationId: asset.attachmentId,
      },
      select: {
        visibility: true,
        organization: {
          select: {
            lifecycleStatus: true,
            publicProfileStatus: true,
            publicProfileBlockedAt: true,
            memberships: viewer
              ? {
                  where: { userId: viewer.id, status: "ACTIVE" },
                  select: { userId: true },
                  take: 1,
                }
              : false,
          },
        },
      },
    });
    publiclyAuthorized = Boolean(
      gallery?.visibility === "PUBLIC" &&
      gallery.organization.lifecycleStatus === "ACTIVE" &&
      gallery.organization.publicProfileStatus === "PUBLISHED" &&
      !gallery.organization.publicProfileBlockedAt,
    );
    authorized = Boolean(
      publiclyAuthorized ||
      (gallery &&
        "memberships" in gallery.organization &&
        gallery.organization.memberships.length),
    );
  }
  if (
    !authorized &&
    viewer &&
    asset.attachmentType === "ORGANIZATION_VERIFICATION" &&
    asset.attachmentId
  ) {
    const document = await prisma.organizationVerificationDocument.findFirst({
      where: {
        mediaId: asset.id,
        requestId: asset.attachmentId,
      },
      select: {
        request: {
          select: {
            organization: {
              select: {
                memberships: {
                  where: { userId: viewer.id },
                  select: { role: true, status: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    authorized = hasOrganizationPermission(
      document?.request.organization.memberships[0],
      "ORGANIZATION_VIEW_PRIVATE_VERIFICATION",
    );
  }
  if (!authorized) throw new MediaError("Media was not found.", 404);
  return publiclyAuthorized
    ? { ...asset, visibility: "PUBLIC" as const }
    : asset;
}

export async function listAdminMedia(
  actor: Actor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: MediaStatus;
    purpose?: MediaPurpose;
  },
) {
  if (!hasAdminPermission(actor.role, "MEDIA_VIEW")) {
    throw new MediaError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25)));
  const query = input.query?.trim();
  const where: Prisma.MediaAssetWhereInput = {
    status: input.status,
    purpose: input.purpose,
    ...(query
      ? {
          OR: [
            { originalFileName: { contains: query, mode: "insensitive" } },
            { owner: { email: { contains: query, mode: "insensitive" } } },
            { owner: { firstName: { contains: query, mode: "insensitive" } } },
            { owner: { lastName: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, records] = await prisma.$transaction([
    prisma.mediaAsset.count({ where }),
    prisma.mediaAsset.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        removedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: records.map(adminMediaDto),
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminMedia(actor: Actor, assetId: string) {
  if (!hasAdminPermission(actor.role, "MEDIA_VIEW")) {
    throw new MediaError("Access denied.", 403);
  }
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: {
      owner: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      removedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  if (!asset) throw new MediaError("Media was not found.", 404);
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "MediaAsset", entityId: assetId },
    include: {
      actor: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    media: adminMediaDto(asset),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actor: log.actor
        ? {
            id: log.actor.id,
            name: `${log.actor.firstName} ${log.actor.lastName}`,
            role: log.actor.role,
          }
        : null,
      createdAt: log.createdAt.toISOString(),
    })),
  };
}

export async function removeMediaAsAdmin(
  actor: Actor,
  assetId: string,
  reason: string,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "MEDIA_MANAGE")) {
    throw new MediaError("Access denied.", 403);
  }
  const existing = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
  });
  if (!existing) throw new MediaError("Media was not found.", 404);
  if (existing.status === "REMOVED") return { removed: true };
  if (existing.status === "PROCESSING") {
    throw new MediaError("Media is currently being processed.", 409);
  }
  const removed = await markMediaRemoved({
    actor,
    asset: existing,
    action: "MEDIA_REMOVED_BY_ADMIN",
    reason: reason.trim(),
    meta,
  });
  await finalizeMediaStorageDeletion(removed);
  return { removed: true };
}

export async function cleanupMediaAssets(now = new Date(), limit = 100) {
  const orphanBefore = new Date(now.getTime() - ORPHAN_GRACE_MS);
  const candidates = await prisma.mediaAsset.findMany({
    where: {
      OR: [
        {
          status: { in: ["PENDING", "PROCESSING"] },
          uploadExpiresAt: { lt: now },
        },
        {
          status: "ACTIVE",
          attachedAt: null,
          createdAt: { lt: orphanBefore },
        },
        {
          status: { in: ["REJECTED", "REMOVED"] },
          storageDeletePending: true,
        },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: Math.min(500, Math.max(1, limit)),
  });

  let cleaned = 0;
  let failed = 0;
  for (const asset of candidates) {
    try {
      const reason =
        asset.status === "ACTIVE"
          ? "Unattached media exceeded the orphan grace period."
          : asset.status === "PENDING" || asset.status === "PROCESSING"
            ? "Upload authorization expired."
            : asset.rejectionReason;
      if (
        asset.status === "ACTIVE" ||
        asset.status === "PENDING" ||
        asset.status === "PROCESSING"
      ) {
        await prisma.$transaction(async (tx) => {
          const removed = await tx.mediaAsset.update({
            where: { id: asset.id },
            data: {
              status: asset.status === "ACTIVE" ? "REMOVED" : "REJECTED",
              scanStatus:
                asset.status === "ACTIVE" ? asset.scanStatus : "ERROR",
              rejectionReason: reason,
              removedAt: asset.status === "ACTIVE" ? now : asset.removedAt,
              storageDeletePending: true,
            },
          });
          await writeAuditLogWithClient(tx, {
            action:
              asset.status === "ACTIVE"
                ? "MEDIA_ORPHAN_REMOVED"
                : "MEDIA_UPLOAD_EXPIRED",
            entityType: "MediaAsset",
            entityId: asset.id,
            oldValue: mediaAuditValue(asset),
            newValue: mediaAuditValue(removed),
          });
        });
      }
      await finalizeMediaStorageDeletion(asset);
      cleaned += 1;
    } catch {
      failed += 1;
    }
  }
  return { inspected: candidates.length, cleaned, failed };
}
