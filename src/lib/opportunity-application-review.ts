import type { Prisma } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { OpportunityError } from "@/lib/opportunities";
import { changeApplicationStatus } from "@/lib/opportunity-applications";
import { applicationStatusLabel } from "@/lib/opportunity-application-status";
import {
  OpportunityAccessError,
  requireApplicationReviewer,
} from "@/lib/opportunity-permissions";
import { prisma } from "@/lib/prisma";
import { serializeOpportunityInterview } from "@/lib/opportunity-interviews";

/**
 * Organization-side application review.
 *
 * Every read is scoped by `organizationId` so an organization can only ever
 * reach applications submitted to its own opportunities. Draft applications are
 * excluded entirely — a reviewer never sees an application the applicant has
 * not submitted.
 *
 * Reviewers see only what the applicant submitted: the snapshot, the answers
 * and the attached documents. Unrelated saved opportunities, messages, roommate
 * or Housing activity, Community activity and other organizations' applications
 * are structurally out of reach.
 */

const reviewListSelect = {
  id: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  assignedReviewerUserId: true,
  applicantSnapshot: true,
  opportunity: { select: { id: true, title: true, type: true } },
  _count: { select: { documents: true } },
} satisfies Prisma.OpportunityApplicationSelect;

function snapshotField(
  snapshot: Prisma.JsonValue | null,
  key: string,
): string | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

export async function listOrganizationApplications(input: {
  userId: string;
  organizationId: string;
  opportunityId?: string | null;
  status?: string | null;
  limit?: number;
}) {
  await requireApplicationReviewer({
    userId: input.userId,
    organizationId: input.organizationId,
  });

  const rows = await prisma.opportunityApplication.findMany({
    where: {
      organizationId: input.organizationId,
      // A draft is private to the applicant until submitted.
      status: input.status ? (input.status as never) : { not: "DRAFT" },
      ...(input.opportunityId ? { opportunityId: input.opportunityId } : {}),
    },
    select: reviewListSelect,
    orderBy: [{ submittedAt: "desc" }, { id: "asc" }],
    take: Math.min(100, Math.max(1, input.limit ?? 50)),
  });

  await trackEvent({
    name: "ORGANIZATION_APPLICATIONS_VIEWED",
    userId: input.userId,
    properties: {},
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    statusLabel: applicationStatusLabel(row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    applicantName: snapshotField(row.applicantSnapshot, "name"),
    degreeLevel: snapshotField(row.applicantSnapshot, "studyLevel"),
    fieldOfStudy: snapshotField(row.applicantSnapshot, "degree"),
    university: snapshotField(row.applicantSnapshot, "university"),
    opportunity: row.opportunity,
    documentCount: row._count.documents,
    assignedReviewerUserId: row.assignedReviewerUserId,
  }));
}

export async function getOrganizationApplication(input: {
  userId: string;
  organizationId: string;
  applicationId: string;
}) {
  const membership = await requireApplicationReviewer({
    userId: input.userId,
    organizationId: input.organizationId,
    permission: "ORGANIZATION_REVIEW_APPLICATIONS",
  });

  const row = await prisma.opportunityApplication.findFirst({
    where: {
      id: input.applicationId,
      organizationId: input.organizationId,
      status: { not: "DRAFT" },
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      decidedAt: true,
      informationDueAt: true,
      offerResponseDueAt: true,
      applicantSnapshot: true,
      consentVersion: true,
      assignedReviewerUserId: true,
      opportunity: {
        select: {
          id: true,
          title: true,
          type: true,
          questions: {
            select: { id: true, label: true, type: true, sortOrder: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
      answers: {
        select: {
          questionId: true,
          answerText: true,
          answerStructured: true,
        },
      },
      documents: {
        select: {
          id: true,
          category: true,
          displayNameSnapshot: true,
          userDocumentId: true,
        },
      },
      statusHistory: {
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          applicantVisibleNote: true,
          internalNote: true,
          actingUserId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      interviews: {
        select: {
          id: true,
          format: true,
          scheduledAt: true,
          timezone: true,
          locationLabel: true,
          meetingUrl: true,
          preparationNote: true,
          status: true,
          applicantRespondedAt: true,
        },
        orderBy: { scheduledAt: "desc" },
      },
    },
  });
  if (!row) throw new OpportunityError("Application not found.", 404);

  return {
    id: row.id,
    status: row.status,
    statusLabel: applicationStatusLabel(row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    consentVersion: row.consentVersion,
    assignedReviewerUserId: row.assignedReviewerUserId,
    opportunity: {
      id: row.opportunity.id,
      title: row.opportunity.title,
      type: row.opportunity.type,
    },
    applicant: {
      name: snapshotField(row.applicantSnapshot, "name"),
      email: snapshotField(row.applicantSnapshot, "email"),
      university: snapshotField(row.applicantSnapshot, "university"),
      degree: snapshotField(row.applicantSnapshot, "degree"),
      studyLevel: snapshotField(row.applicantSnapshot, "studyLevel"),
      city: snapshotField(row.applicantSnapshot, "city"),
      country: snapshotField(row.applicantSnapshot, "country"),
    },
    answers: row.opportunity.questions.map((question) => {
      const answer = row.answers.find(
        (entry) => entry.questionId === question.id,
      );
      return {
        questionId: question.id,
        label: question.label,
        type: question.type,
        answerText: answer?.answerText ?? null,
        answerStructured: answer?.answerStructured ?? null,
      };
    }),
    documents: row.documents.map((document) => ({
      id: document.id,
      category: document.category,
      displayName: document.displayNameSnapshot,
      // Delivery goes through the authorized private document route, which
      // re-checks membership and attachment. No storage key is exposed.
      href: `/api/opportunities/documents/${document.userDocumentId}/download`,
    })),
    timeline: row.statusHistory.map((entry) => ({
      id: entry.id,
      from: entry.fromStatus,
      to: entry.toStatus,
      label: applicationStatusLabel(entry.toStatus),
      applicantVisibleNote: entry.applicantVisibleNote,
      // Internal notes are returned only to reviewers holding the review
      // permission, which requireApplicationReviewer just enforced.
      internalNote: hasOrganizationPermission(
        membership,
        "ORGANIZATION_REVIEW_APPLICATIONS",
      )
        ? entry.internalNote
        : null,
      at: entry.createdAt.toISOString(),
    })),
    interviews: row.interviews.map(serializeOpportunityInterview),
  };
}

export async function reviewerChangeApplicationStatus(input: {
  userId: string;
  organizationId: string;
  applicationId: string;
  toStatus: Parameters<typeof changeApplicationStatus>[0]["toStatus"];
  applicantVisibleNote?: string | null;
  internalNote?: string | null;
  informationDueAt?: Date | null;
  offerResponseDueAt?: Date | null;
}) {
  await requireApplicationReviewer({
    userId: input.userId,
    organizationId: input.organizationId,
    permission: "ORGANIZATION_CHANGE_APPLICATION_STATUS",
  });

  // Re-scope by organization so a valid permission in one organization cannot
  // be used against another organization's application id.
  const owned = await prisma.opportunityApplication.findFirst({
    where: {
      id: input.applicationId,
      organizationId: input.organizationId,
      status: { not: "DRAFT" },
    },
    select: { id: true },
  });
  if (!owned) throw new OpportunityError("Application not found.", 404);

  const result = await changeApplicationStatus({
    actorUserId: input.userId,
    actor: "REVIEWER",
    applicationId: input.applicationId,
    toStatus: input.toStatus,
    applicantVisibleNote: input.applicantVisibleNote,
    internalNote: input.internalNote,
    informationDueAt: input.informationDueAt,
    offerResponseDueAt: input.offerResponseDueAt,
  });

  await trackEvent({
    name: "ORGANIZATION_APPLICATION_STATUS_CHANGED",
    userId: input.userId,
    properties: { toStatus: input.toStatus },
  });
  return result;
}

/**
 * Reviewer assignment. Kept to a single reviewer to stay simple and auditable.
 * The applicant is deliberately not notified: assignment is internal.
 */
export async function assignApplicationReviewer(input: {
  userId: string;
  organizationId: string;
  applicationId: string;
  reviewerUserId: string | null;
}) {
  await requireApplicationReviewer({
    userId: input.userId,
    organizationId: input.organizationId,
    permission: "ORGANIZATION_REVIEW_APPLICATIONS",
  });

  if (input.reviewerUserId) {
    const reviewer = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.reviewerUserId,
        },
      },
      select: { role: true, status: true },
    });
    // The assignee must be an active member who could actually review, so
    // assignment can never be used to widen access.
    if (
      !reviewer ||
      reviewer.status !== "ACTIVE" ||
      !hasOrganizationPermission(reviewer, "ORGANIZATION_REVIEW_APPLICATIONS")
    ) {
      throw new OpportunityAccessError(
        "Choose an active member who can review applications.",
        400,
      );
    }
  }

  const updated = await prisma.opportunityApplication.updateMany({
    where: {
      id: input.applicationId,
      organizationId: input.organizationId,
      status: { not: "DRAFT" },
    },
    data: { assignedReviewerUserId: input.reviewerUserId },
  });
  if (updated.count === 0) {
    throw new OpportunityError("Application not found.", 404);
  }

  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: "OPPORTUNITY_APPLICATION_REVIEWER_ASSIGNED",
    entityType: "OpportunityApplication",
    entityId: input.applicationId,
    newValue: { assignedReviewerUserId: input.reviewerUserId },
  });
  return { assignedReviewerUserId: input.reviewerUserId };
}
