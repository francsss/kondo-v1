import type { OfficialProfileStatus, Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { attachMediaAsset } from "@/lib/media";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type {
  verificationAdminDecisionSchema,
  verificationRequestSchema,
} from "@/lib/story-validation";
import type { z } from "zod";

type Actor = { id: string; role: AppRole | string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
type VerificationInput = z.infer<typeof verificationRequestSchema>;
type VerificationDecision = z.infer<typeof verificationAdminDecisionSchema>;

export class OfficialProfileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OfficialProfileError";
  }
}

const activeRequestStatuses: OfficialProfileStatus[] = [
  "STARTED",
  "SUBMITTED",
  "MORE_INFO_REQUIRED",
  "UNDER_REVIEW",
  "REVIEW_REQUIRED",
];

export async function getOwnVerificationState(actor: Actor) {
  const [user, requests] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: actor.id },
      select: {
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
        officialReviewDueAt: true,
      },
    }),
    prisma.officialVerificationRequest.findMany({
      where: { applicantId: actor.id },
      select: {
        id: true,
        status: true,
        organizationType: true,
        organizationName: true,
        authorityDescription: true,
        officialWebsite: true,
        decisionReason: true,
        submittedAt: true,
        reviewedAt: true,
        nextReviewAt: true,
        version: true,
        createdAt: true,
        updatedAt: true,
        documents: {
          select: { id: true, label: true, mediaId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { user, requests };
}

export async function submitVerificationRequest(
  actor: Actor,
  input: VerificationInput,
  meta: RequestMeta = {},
) {
  const media = await prisma.mediaAsset.findMany({
    where: {
      id: { in: input.documents.map((document) => document.mediaId) },
      ownerId: actor.id,
      purpose: "VERIFICATION_DOCUMENT",
      kind: "DOCUMENT",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
    },
    select: { id: true },
  });
  if (media.length !== input.documents.length) {
    throw new OfficialProfileError(
      "One or more verification documents are unavailable.",
    );
  }
  const existing = await prisma.officialVerificationRequest.findFirst({
    where: {
      applicantId: actor.id,
      status: { in: activeRequestStatuses },
    },
    orderBy: { createdAt: "desc" },
  });
  if (
    existing &&
    !["STARTED", "MORE_INFO_REQUIRED", "REVIEW_REQUIRED"].includes(
      existing.status,
    )
  ) {
    throw new OfficialProfileError(
      "Your verification request is already being reviewed.",
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const request = existing
      ? await tx.officialVerificationRequest.update({
          where: { id: existing.id },
          data: {
            status: "SUBMITTED",
            organizationType: input.organizationType,
            organizationName: input.organizationName,
            authorityDescription: input.authorityDescription,
            officialWebsite: input.officialWebsite,
            decisionReason: null,
            submittedAt: new Date(),
            version: { increment: 1 },
            documents: {
              create: input.documents.map((document) => ({
                mediaId: document.mediaId,
                label: document.label,
              })),
            },
          },
        })
      : await tx.officialVerificationRequest.create({
          data: {
            applicantId: actor.id,
            status: "SUBMITTED",
            organizationType: input.organizationType,
            organizationName: input.organizationName,
            authorityDescription: input.authorityDescription,
            officialWebsite: input.officialWebsite,
            submittedAt: new Date(),
            documents: {
              create: input.documents.map((document) => ({
                mediaId: document.mediaId,
                label: document.label,
              })),
            },
          },
        });
    for (const document of input.documents) {
      await attachMediaAsset(tx, {
        ownerId: actor.id,
        assetId: document.mediaId,
        purpose: "VERIFICATION_DOCUMENT",
        attachmentType: "OFFICIAL_VERIFICATION",
        attachmentId: request.id,
      });
    }
    await tx.user.update({
      where: { id: actor.id },
      data: {
        officialProfileStatus: "SUBMITTED",
        officialOrganizationType: input.organizationType,
        officialOrganizationName: input.organizationName,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: existing
        ? "OFFICIAL_VERIFICATION_RESUBMITTED"
        : "OFFICIAL_VERIFICATION_SUBMITTED",
      entityType: "OfficialVerificationRequest",
      entityId: request.id,
      newValue: {
        status: request.status,
        organizationType: request.organizationType,
        organizationName: request.organizationName,
        documentCount: input.documents.length,
        version: request.version,
      },
      ...meta,
    });
    return {
      id: request.id,
      status: request.status,
      submittedAt: request.submittedAt?.toISOString() ?? null,
    };
  });
}

export async function listVerificationRequests(
  actor: Actor,
  input: {
    status?: OfficialProfileStatus;
    query?: string;
    page?: number;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "OFFICIAL_PROFILE_VIEW")) {
    throw new OfficialProfileError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = 25;
  const where: Prisma.OfficialVerificationRequestWhereInput = {
    status: input.status,
    ...(input.query
      ? {
          OR: [
            {
              organizationName: {
                contains: input.query,
                mode: "insensitive",
              },
            },
            {
              applicant: {
                OR: [
                  {
                    firstName: {
                      contains: input.query,
                      mode: "insensitive",
                    },
                  },
                  {
                    lastName: {
                      contains: input.query,
                      mode: "insensitive",
                    },
                  },
                  {
                    email: {
                      contains: input.query,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };
  const [total, records] = await prisma.$transaction([
    prisma.officialVerificationRequest.count({ where }),
    prisma.officialVerificationRequest.findMany({
      where,
      select: {
        id: true,
        status: true,
        organizationType: true,
        organizationName: true,
        authorityDescription: true,
        officialWebsite: true,
        decisionReason: true,
        submittedAt: true,
        reviewedAt: true,
        nextReviewAt: true,
        version: true,
        updatedAt: true,
        applicant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            officialProfileStatus: true,
          },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
        documents: {
          select: { id: true, label: true, mediaId: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const allowedDecisionTargets: Record<string, readonly string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "MORE_INFO_REQUIRED", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["MORE_INFO_REQUIRED", "APPROVED", "REJECTED"],
  MORE_INFO_REQUIRED: ["UNDER_REVIEW", "REJECTED"],
  REVIEW_REQUIRED: ["UNDER_REVIEW", "APPROVED", "SUSPENDED", "REVOKED"],
  APPROVED: ["SUSPENDED", "REVOKED", "REVIEW_REQUIRED"],
  SUSPENDED: ["APPROVED", "REVOKED", "REVIEW_REQUIRED"],
};

export async function decideVerificationRequest(
  actor: Actor,
  requestId: string,
  input: VerificationDecision,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "OFFICIAL_PROFILE_MANAGE")) {
    throw new OfficialProfileError("Access denied.", 403);
  }
  const current = await prisma.officialVerificationRequest.findUnique({
    where: { id: requestId },
  });
  if (!current) {
    throw new OfficialProfileError("Verification request was not found.", 404);
  }
  if (!allowedDecisionTargets[current.status]?.includes(input.status)) {
    throw new OfficialProfileError(
      `Request cannot move from ${current.status} to ${input.status}.`,
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const reviewedAt = new Date();
    const request = await tx.officialVerificationRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        decisionReason: input.reason,
        reviewerId: actor.id,
        reviewedAt,
        nextReviewAt: input.nextReviewAt,
        version: { increment: 1 },
      },
    });
    await tx.user.update({
      where: { id: current.applicantId },
      data: {
        officialProfileStatus: input.status,
        officialOrganizationType:
          input.status === "APPROVED" ? current.organizationType : undefined,
        officialOrganizationName:
          input.status === "APPROVED" ? current.organizationName : undefined,
        officialVerifiedAt: input.status === "APPROVED" ? reviewedAt : null,
        officialReviewDueAt:
          input.status === "APPROVED" ? input.nextReviewAt : null,
      },
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: current.applicantId,
      actorId: actor.id,
      type: "MODERATION_UPDATE",
      templateKey: "MODERATION_RESULT",
      data: {
        outcome:
          input.status === "MORE_INFO_REQUIRED"
            ? `Kondo needs more information for your official profile request: ${input.reason}`
            : `Your official profile request is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
      },
      href: "/settings/official-profile",
      dedupeKey: `official-verification:${requestId}:${request.version}:${input.status}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: `OFFICIAL_PROFILE_${input.status}`,
      entityType: "OfficialVerificationRequest",
      entityId: requestId,
      oldValue: {
        status: current.status,
        reviewerId: current.reviewerId,
        version: current.version,
      },
      newValue: {
        status: request.status,
        reviewerId: actor.id,
        reason: input.reason,
        nextReviewAt: input.nextReviewAt,
        version: request.version,
      },
      ...meta,
    });
    return {
      id: request.id,
      status: request.status,
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    };
  });
}

export function publicOfficialProfile(input: {
  officialProfileStatus: string;
  officialOrganizationType?: string | null;
  officialOrganizationName?: string | null;
  officialVerifiedAt?: Date | null;
}) {
  if (input.officialProfileStatus !== "APPROVED") return null;
  return {
    type: input.officialOrganizationType,
    organizationName: input.officialOrganizationName,
    verifiedAt: input.officialVerifiedAt?.toISOString() ?? null,
  };
}
