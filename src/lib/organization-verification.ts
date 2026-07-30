import {
  Prisma,
  type OrganizationVerificationRequestStatus,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission } from "@/lib/authorization";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { revalidateOrganizationPublicSurfaces } from "@/lib/organization-cache";

type Actor = { id: string; role: string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
type DocumentInput = {
  mediaId: string;
  type:
    | "BUSINESS_REGISTRATION"
    | "UNIVERSITY_AUTHORIZATION"
    | "ASSOCIATION_REGISTRATION"
    | "REPRESENTATIVE_AUTHORIZATION"
    | "OFFICIAL_LETTER"
    | "ADDRESS_PROOF"
    | "OTHER";
  label: string;
};
type VerificationInput = {
  legalName: string;
  registrationNumber?: string;
  registrationCountryId: string;
  authorityDescription: string;
  officialWebsite?: string;
  publicContactEmail: string;
  documents: DocumentInput[];
};

const OPEN_STATUSES: OrganizationVerificationRequestStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
];

const REVIEW_TRANSITIONS: Partial<
  Record<
    OrganizationVerificationRequestStatus,
    readonly OrganizationVerificationRequestStatus[]
  >
> = {
  SUBMITTED: [
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "APPROVED",
    "REJECTED",
  ],
  UNDER_REVIEW: ["MORE_INFORMATION_REQUIRED", "APPROVED", "REJECTED"],
  APPROVED: ["SUSPENDED", "REVOKED"],
  SUSPENDED: ["APPROVED", "REVOKED"],
};

async function assertVerificationMedia(
  actorId: string,
  documents: DocumentInput[],
) {
  const uniqueIds = [...new Set(documents.map((document) => document.mediaId))];
  if (uniqueIds.length !== documents.length) {
    throw new OrganizationError(
      "Each verification document can be attached only once.",
    );
  }
  const media = await prisma.mediaAsset.count({
    where: {
      id: { in: uniqueIds },
      ownerId: actorId,
      purpose: "ORGANIZATION_VERIFICATION_DOCUMENT",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      kind: { in: ["IMAGE", "DOCUMENT"] },
    },
  });
  if (media !== documents.length) {
    throw new OrganizationError(
      "One or more private verification documents are unavailable.",
    );
  }
}

async function saveVerificationWithClient(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  input: VerificationInput,
  submit: boolean,
  meta: RequestMeta,
) {
  await requireOrganizationPermission(
    actor.id,
    { id: organizationId },
    "ORGANIZATION_MANAGE_VERIFICATION",
    tx,
  );
  const organization = await tx.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      publicName: true,
      legalName: true,
      lifecycleStatus: true,
      verificationStatus: true,
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  if (
    organization.lifecycleStatus === "ARCHIVED" ||
    organization.lifecycleStatus === "SUSPENDED"
  ) {
    throw new OrganizationError(
      "Verification cannot be changed in the current organization state.",
      409,
    );
  }
  const country = await tx.country.findFirst({
    where: { id: input.registrationCountryId, isActive: true },
    select: { id: true },
  });
  if (!country) throw new OrganizationError("Select an active country.");

  const request = await tx.organizationVerificationRequest.findFirst({
    where: { organizationId, status: { in: OPEN_STATUSES } },
    include: { documents: true },
    orderBy: { createdAt: "desc" },
  });
  if (
    request &&
    !["DRAFT", "MORE_INFORMATION_REQUIRED"].includes(request.status)
  ) {
    throw new OrganizationError(
      "This organization verification is already being reviewed.",
      409,
    );
  }
  const nextStatus = submit ? "SUBMITTED" : (request?.status ?? "DRAFT");
  const saved = request
    ? await tx.organizationVerificationRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          legalNameSnapshot: input.legalName,
          registrationNumber: input.registrationNumber,
          registrationCountryId: input.registrationCountryId,
          authorityDescription: input.authorityDescription,
          officialWebsite: input.officialWebsite,
          publicContactEmail: input.publicContactEmail,
          submittedAt: submit ? new Date() : request.submittedAt,
          reviewerUserId: submit ? null : request.reviewerUserId,
          reviewerNote: submit ? null : request.reviewerNote,
          userVisibleResponse: submit ? null : request.userVisibleResponse,
          version: { increment: 1 },
        },
      })
    : await tx.organizationVerificationRequest.create({
        data: {
          organizationId,
          submittedByUserId: actor.id,
          status: nextStatus,
          legalNameSnapshot: input.legalName,
          registrationNumber: input.registrationNumber,
          registrationCountryId: input.registrationCountryId,
          authorityDescription: input.authorityDescription,
          officialWebsite: input.officialWebsite,
          publicContactEmail: input.publicContactEmail,
          submittedAt: submit ? new Date() : null,
        },
      });

  const keepMedia = new Set(input.documents.map(({ mediaId }) => mediaId));
  const removedDocuments =
    request?.documents.filter((document) => !keepMedia.has(document.mediaId)) ??
    [];
  if (removedDocuments.length) {
    await tx.organizationVerificationDocument.deleteMany({
      where: { id: { in: removedDocuments.map(({ id }) => id) } },
    });
    await tx.mediaAsset.updateMany({
      where: {
        id: { in: removedDocuments.map(({ mediaId }) => mediaId) },
        attachmentType: "ORGANIZATION_VERIFICATION",
        attachmentId: saved.id,
      },
      data: {
        attachedAt: null,
        attachmentType: null,
        attachmentId: null,
      },
    });
  }
  for (const document of input.documents) {
    await tx.organizationVerificationDocument.upsert({
      where: { mediaId: document.mediaId },
      create: {
        requestId: saved.id,
        mediaId: document.mediaId,
        type: document.type,
        label: document.label,
      },
      update: {
        requestId: saved.id,
        type: document.type,
        label: document.label,
      },
    });
    await attachMediaAsset(tx, {
      ownerId: actor.id,
      assetId: document.mediaId,
      purpose: "ORGANIZATION_VERIFICATION_DOCUMENT",
      attachmentType: "ORGANIZATION_VERIFICATION",
      attachmentId: saved.id,
    });
  }
  await tx.organization.update({
    where: { id: organizationId },
    data: {
      legalName: organization.legalName ?? input.legalName,
      verificationStatus: submit ? "PENDING" : organization.verificationStatus,
    },
  });
  await writeAuditLogWithClient(tx, {
    actorId: actor.id,
    organizationId,
    action: submit
      ? request?.status === "MORE_INFORMATION_REQUIRED"
        ? "ORGANIZATION_VERIFICATION_RESUBMITTED"
        : "ORGANIZATION_VERIFICATION_SUBMITTED"
      : "ORGANIZATION_VERIFICATION_DRAFT_SAVED",
    entityType: "OrganizationVerificationRequest",
    entityId: saved.id,
    newValue: {
      status: saved.status,
      documentCount: input.documents.length,
      version: saved.version,
    },
    ...meta,
  });
  return {
    id: saved.id,
    status: saved.status,
    submittedAt: saved.submittedAt?.toISOString() ?? null,
    version: saved.version,
  };
}

export async function saveOrganizationVerificationDraft(
  actor: Actor,
  organizationId: string,
  input: VerificationInput,
  meta: RequestMeta = {},
) {
  await assertVerificationMedia(actor.id, input.documents);
  try {
    const result = await prisma.$transaction((tx) =>
      saveVerificationWithClient(tx, actor, organizationId, input, false, meta),
    );
    await captureServerProductEvent({
      distinctId: actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_VERIFICATION_DRAFT_SAVED,
      properties: { document_count: input.documents.length },
    });
    return result;
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationError(error.message, error.status);
    }
    throw error;
  }
}

export async function submitOrganizationVerification(
  actor: Actor,
  organizationId: string,
  input: VerificationInput,
  meta: RequestMeta = {},
) {
  if (!input.documents.length) {
    throw new OrganizationError(
      "Upload at least one supporting verification document.",
    );
  }
  await assertVerificationMedia(actor.id, input.documents);
  try {
    const result = await prisma.$transaction(
      (tx) =>
        saveVerificationWithClient(
          tx,
          actor,
          organizationId,
          input,
          true,
          meta,
        ),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
    await captureServerProductEvent({
      distinctId: actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_VERIFICATION_SUBMITTED,
      properties: { document_count: input.documents.length },
    });
    return result;
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationError(error.message, error.status);
    }
    throw error;
  }
}

export async function getOrganizationVerificationState(
  actorId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    actorId,
    { id: organizationId },
    "ORGANIZATION_VIEW_PRIVATE_VERIFICATION",
  );
  const request = await prisma.organizationVerificationRequest.findFirst({
    where: { organizationId },
    select: {
      id: true,
      status: true,
      legalNameSnapshot: true,
      registrationNumber: true,
      registrationCountryId: true,
      authorityDescription: true,
      officialWebsite: true,
      publicContactEmail: true,
      userVisibleResponse: true,
      submittedAt: true,
      reviewedAt: true,
      version: true,
      documents: {
        select: {
          id: true,
          mediaId: true,
          type: true,
          label: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!request) return null;
  return {
    ...request,
    submittedAt: request.submittedAt?.toISOString() ?? null,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    documents: request.documents.map((document) => ({
      ...document,
      createdAt: document.createdAt.toISOString(),
    })),
  };
}

export async function listOrganizationVerificationRequests(
  actor: Actor,
  input: {
    status?: OrganizationVerificationRequestStatus;
    query?: string;
    page?: number;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATION_VERIFICATIONS_VIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = 25;
  const where: Prisma.OrganizationVerificationRequestWhereInput = {
    status: input.status ? input.status : { notIn: ["DRAFT", "WITHDRAWN"] },
    ...(input.query
      ? {
          organization: {
            OR: [
              {
                publicName: {
                  contains: input.query,
                  mode: "insensitive",
                },
              },
              {
                legalName: {
                  contains: input.query,
                  mode: "insensitive",
                },
              },
            ],
          },
        }
      : {}),
  };
  const [total, records] = await prisma.$transaction([
    prisma.organizationVerificationRequest.count({ where }),
    prisma.organizationVerificationRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            slug: true,
            publicName: true,
            legalName: true,
            type: true,
            verificationStatus: true,
            city: { select: { slug: true } },
            isOfficialPartner: true,
          },
        },
        submittedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        _count: { select: { documents: true } },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: records.map((record) => ({
      ...record,
      submittedAt: record.submittedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminOrganizationVerification(
  actor: Actor,
  requestId: string,
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATION_VERIFICATIONS_VIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const request = await prisma.organizationVerificationRequest.findUnique({
    where: { id: requestId },
    include: {
      organization: {
        select: {
          id: true,
          slug: true,
          publicName: true,
          legalName: true,
          type: true,
          lifecycleStatus: true,
          verificationStatus: true,
          isOfficialPartner: true,
          country: { select: { name: true, code: true } },
          city: { select: { name: true } },
        },
      },
      registrationCountry: {
        select: { id: true, name: true, code: true },
      },
      submittedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      reviewer: {
        select: { id: true, firstName: true, lastName: true },
      },
      documents: {
        include: {
          media: {
            select: {
              id: true,
              kind: true,
              originalFileName: true,
              declaredMime: true,
              detectedMime: true,
              sizeBytes: true,
              scanStatus: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!request) {
    throw new OrganizationError("Verification request not found.", 404);
  }
  if (request.status === "DRAFT" || request.status === "WITHDRAWN") {
    throw new OrganizationError("Verification request not found.", 404);
  }
  return request;
}

export async function decideOrganizationVerification(
  actor: Actor,
  requestId: string,
  input: {
    status:
      | "UNDER_REVIEW"
      | "MORE_INFORMATION_REQUIRED"
      | "APPROVED"
      | "REJECTED"
      | "SUSPENDED"
      | "REVOKED";
    userVisibleResponse: string;
    reviewerNote?: string;
  },
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATION_VERIFICATIONS_REVIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.organizationVerificationRequest.findUnique({
      where: { id: requestId },
      include: {
        organization: {
          select: {
            id: true,
            slug: true,
            publicName: true,
            verificationStatus: true,
            city: { select: { slug: true } },
            memberships: {
              where: {
                status: "ACTIVE",
                role: { in: ["OWNER", "ADMIN"] },
              },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!current) {
      throw new OrganizationError("Verification request not found.", 404);
    }
    if (!REVIEW_TRANSITIONS[current.status]?.includes(input.status)) {
      throw new OrganizationError(
        `Verification cannot move from ${current.status} to ${input.status}.`,
        409,
      );
    }
    const reviewedAt = new Date();
    const request = await tx.organizationVerificationRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        reviewerUserId: actor.id,
        reviewerNote: input.reviewerNote,
        userVisibleResponse: input.userVisibleResponse,
        reviewedAt,
        version: { increment: 1 },
      },
    });
    const summaryStatus =
      input.status === "APPROVED"
        ? "VERIFIED"
        : input.status === "MORE_INFORMATION_REQUIRED"
          ? "MORE_INFORMATION_REQUIRED"
          : input.status === "SUSPENDED"
            ? "SUSPENDED"
            : input.status === "REVOKED"
              ? "REVOKED"
              : input.status === "REJECTED"
                ? "REJECTED"
                : "PENDING";
    await tx.organization.update({
      where: { id: current.organizationId },
      data: { verificationStatus: summaryStatus },
    });
    for (const membership of current.organization.memberships) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: membership.userId,
        actorId: actor.id,
        type: "MODERATION_UPDATE",
        templateKey: "ORGANIZATION_VERIFICATION_UPDATE",
        data: {
          organizationName: current.organization.publicName,
          outcome: input.userVisibleResponse,
        },
        href: `/organizations/${current.organization.slug}/verification`,
        dedupeKey: `organization-verification:${request.id}:${request.version}:${input.status}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId: current.organizationId,
      action: `ORGANIZATION_VERIFICATION_${input.status}`,
      entityType: "OrganizationVerificationRequest",
      entityId: request.id,
      oldValue: {
        status: current.status,
        verificationStatus: current.organization.verificationStatus,
      },
      newValue: {
        status: request.status,
        verificationStatus: summaryStatus,
        userVisibleResponse: input.userVisibleResponse,
        version: request.version,
      },
      ...meta,
    });
    return {
      id: request.id,
      status: request.status,
      verificationStatus: summaryStatus,
      reviewedAt: reviewedAt.toISOString(),
      slug: current.organization.slug,
      citySlug: current.organization.city?.slug ?? null,
    };
  });
  revalidateOrganizationPublicSurfaces(result);
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_VERIFICATION_REVIEWED,
    properties: { verification_outcome: input.status },
  });
  return result;
}
