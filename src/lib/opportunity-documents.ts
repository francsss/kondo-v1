import type { OpportunityDocumentCategory, Prisma } from "@prisma/client";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { OpportunityError } from "@/lib/opportunities";
import { prisma } from "@/lib/prisma";

/**
 * Private candidate document vault.
 *
 * Documents live in the existing MediaAsset pipeline under the dedicated
 * private purpose OPPORTUNITY_APPLICATION_DOCUMENT. They are never public, and
 * a raw storage key (`objectKey`) is never serialized out of this module.
 *
 * Access is granted in exactly two ways:
 *   - the owning applicant;
 *   - an active member of the organization that received an application the
 *     document is actually attached to, holding an application permission.
 * There is no third path: a platform admin role does not qualify here, and an
 * organization cannot reach a document that was never attached to one of its
 * own applications.
 *
 * Attaching one document to several applications reuses the same
 * UserOpportunityDocument row rather than copying the file.
 */

/** Categories that carry identity data and warrant a stronger warning. */
export const SENSITIVE_DOCUMENT_CATEGORIES: readonly OpportunityDocumentCategory[] =
  ["PASSPORT_COPY"];

export function isSensitiveDocumentCategory(
  category: OpportunityDocumentCategory,
) {
  return SENSITIVE_DOCUMENT_CATEGORIES.includes(category);
}

export const documentSelect = {
  id: true,
  category: true,
  displayName: true,
  institution: true,
  issuedOn: true,
  expiresOn: true,
  language: true,
  createdAt: true,
  updatedAt: true,
  media: {
    select: {
      id: true,
      status: true,
      scanStatus: true,
      sizeBytes: true,
      originalFileName: true,
      declaredMime: true,
      visibility: true,
      purpose: true,
    },
  },
} satisfies Prisma.UserOpportunityDocumentSelect;

type DocumentRow = Prisma.UserOpportunityDocumentGetPayload<{
  select: typeof documentSelect;
}>;

/**
 * The only serializer for candidate documents. `objectKey` is not selected
 * above and therefore cannot leak; the media id is exposed so an authorized
 * caller can request delivery through the existing private media route.
 */
export function serializeOpportunityDocument(row: DocumentRow) {
  return {
    id: row.id,
    category: row.category,
    displayName: row.displayName,
    institution: row.institution,
    issuedOn: row.issuedOn?.toISOString().slice(0, 10) ?? null,
    expiresOn: row.expiresOn?.toISOString().slice(0, 10) ?? null,
    language: row.language,
    fileName: row.media.originalFileName,
    sizeBytes: row.media.sizeBytes,
    mimeType: row.media.declaredMime,
    mediaId: row.media.id,
    // A document that has not cleared validation and scanning is listed but
    // cannot be attached or delivered.
    ready: row.media.status === "ACTIVE",
    scanStatus: row.media.scanStatus,
    sensitive: isSensitiveDocumentCategory(row.category),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUserOpportunityDocuments(userId: string) {
  const rows = await prisma.userOpportunityDocument.findMany({
    where: { userId, archivedAt: null },
    select: documentSelect,
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(serializeOpportunityDocument);
}

export async function createUserOpportunityDocument(input: {
  userId: string;
  mediaId: string;
  category: OpportunityDocumentCategory;
  displayName: string;
  institution?: string | null;
  issuedOn?: Date | null;
  expiresOn?: Date | null;
  language?: string | null;
}) {
  // The media asset must belong to the caller and must have been uploaded under
  // the private application-document purpose. This blocks attaching someone
  // else's file, and blocks re-using a public listing or organization image as
  // an application document.
  const media = await prisma.mediaAsset.findFirst({
    where: {
      id: input.mediaId,
      ownerId: input.userId,
      purpose: "OPPORTUNITY_APPLICATION_DOCUMENT",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
    },
    select: { id: true, status: true, scanStatus: true },
  });
  if (!media) {
    throw new OpportunityError("Upload the document again.", 400);
  }
  if (media.scanStatus === "FLAGGED") {
    throw new OpportunityError("This file did not pass the safety check.", 400);
  }

  const row = await prisma.userOpportunityDocument.create({
    data: {
      userId: input.userId,
      mediaId: input.mediaId,
      category: input.category,
      displayName: input.displayName.trim().slice(0, 200),
      institution: input.institution?.trim() || null,
      issuedOn: input.issuedOn ?? null,
      expiresOn: input.expiresOn ?? null,
      language: input.language?.trim() || null,
    },
    select: documentSelect,
  });
  return serializeOpportunityDocument(row);
}

/**
 * Soft delete. A document already attached to a submitted application is
 * archived rather than destroyed so the submission snapshot stays intact.
 */
export async function archiveUserOpportunityDocument(input: {
  userId: string;
  documentId: string;
}) {
  const updated = await prisma.userOpportunityDocument.updateMany({
    where: { id: input.documentId, userId: input.userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (updated.count === 0) {
    throw new OpportunityError("Document not found.", 404);
  }
  return { archived: true };
}

/**
 * Authorization for delivering a private application document.
 *
 * Returns the media id only when the caller is the owner, or an authorized
 * reviewer of an application this document is genuinely attached to.
 */
export async function authorizeDocumentAccess(input: {
  viewerUserId: string;
  documentId: string;
}) {
  const document = await prisma.userOpportunityDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      userId: true,
      media: { select: { id: true, scanStatus: true, status: true } },
      attachments: {
        select: {
          application: {
            select: { id: true, organizationId: true, status: true },
          },
        },
      },
    },
  });
  if (!document) {
    throw new OpportunityError("Document not found.", 404);
  }
  if (document.media.scanStatus === "FLAGGED") {
    throw new OpportunityError("This file is not available.", 403);
  }

  if (document.userId === input.viewerUserId) {
    return { mediaId: document.media.id, role: "OWNER" as const };
  }

  // Only organizations that actually received an application carrying this
  // document are considered, and only for applications the applicant submitted.
  const organizationIds = [
    ...new Set(
      document.attachments
        .map((attachment) => attachment.application)
        .filter((application) => application.status !== "DRAFT")
        .map((application) => application.organizationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (organizationIds.length === 0) {
    throw new OpportunityError("Document not found.", 404);
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId: input.viewerUserId,
      organizationId: { in: organizationIds },
      status: "ACTIVE",
    },
    select: { organizationId: true, role: true, status: true },
  });
  if (
    !membership ||
    !hasOrganizationPermission(membership, "ORGANIZATION_REVIEW_APPLICATIONS")
  ) {
    throw new OpportunityError("Document not found.", 404);
  }

  return { mediaId: document.media.id, role: "REVIEWER" as const };
}
