import type { Prisma } from "@prisma/client";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { hasOrganizationPermission } from "@/lib/organization-authorization";

async function reviewerIds(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  const memberships = await tx.organizationMembership.findMany({
    where: { organizationId, status: "ACTIVE" },
    select: { userId: true, role: true, status: true },
  });
  return memberships
    .filter((membership) =>
      hasOrganizationPermission(membership, "ORGANIZATION_REVIEW_APPLICATIONS"),
    )
    .map(({ userId }) => userId);
}

export async function notifyApplicationSubmittedWithClient(
  tx: Prisma.TransactionClient,
  input: {
    applicationId: string;
    opportunityId: string;
    opportunityTitle: string;
    applicantUserId: string;
    organizationId: string | null;
    organizationSlug: string | null;
  },
) {
  await enqueueNotificationJobWithClient(tx, {
    recipientId: input.applicantUserId,
    type: "OPPORTUNITY",
    templateKey: "OPPORTUNITY_APPLICATION_SUBMITTED",
    data: { opportunityTitle: input.opportunityTitle },
    href: `/opportunities/applications/${input.applicationId}`,
    dedupeKey: `opportunity-application-submitted:${input.applicationId}`,
  });
  if (!input.organizationId || !input.organizationSlug) return;
  const recipients = await reviewerIds(tx, input.organizationId);
  await Promise.all(
    recipients.map((recipientId) =>
      enqueueNotificationJobWithClient(tx, {
        recipientId,
        actorId: input.applicantUserId,
        type: "OPPORTUNITY",
        templateKey: "OPPORTUNITY_NEW_APPLICATION",
        data: { opportunityTitle: input.opportunityTitle },
        href: `/organizations/${input.organizationSlug}/opportunities/applications/${input.applicationId}`,
        dedupeKey: `opportunity-new-application:${input.applicationId}`,
      }),
    ),
  );
}

export function notifyApplicationStatusWithClient(
  tx: Prisma.TransactionClient,
  input: {
    applicationId: string;
    applicantUserId: string;
    actorId: string;
    opportunityTitle: string;
    status: string;
    historyId: string;
  },
) {
  return enqueueNotificationJobWithClient(tx, {
    recipientId: input.applicantUserId,
    actorId: input.actorId,
    type: "OPPORTUNITY",
    templateKey: "OPPORTUNITY_APPLICATION_STATUS",
    data: {
      opportunityTitle: input.opportunityTitle,
      status: input.status.toLowerCase().replaceAll("_", " "),
    },
    href: `/opportunities/applications/${input.applicationId}`,
    dedupeKey: `opportunity-application-status:${input.historyId}`,
  });
}

export function notifyInterviewInvitationWithClient(
  tx: Prisma.TransactionClient,
  input: {
    interviewId: string;
    applicationId: string;
    applicantUserId: string;
    actorId: string;
    opportunityTitle: string;
  },
) {
  return enqueueNotificationJobWithClient(tx, {
    recipientId: input.applicantUserId,
    actorId: input.actorId,
    type: "OPPORTUNITY",
    templateKey: "OPPORTUNITY_INTERVIEW_INVITATION",
    data: { opportunityTitle: input.opportunityTitle },
    href: `/opportunities/applications/${input.applicationId}`,
    dedupeKey: `opportunity-interview:${input.interviewId}`,
  });
}

export async function notifyApplicantResponseWithClient(
  tx: Prisma.TransactionClient,
  input: {
    applicationId: string;
    organizationId: string;
    organizationSlug: string;
    applicantUserId: string;
    opportunityTitle: string;
    responseKey: string;
  },
) {
  const recipients = await reviewerIds(tx, input.organizationId);
  await Promise.all(
    recipients.map((recipientId) =>
      enqueueNotificationJobWithClient(tx, {
        recipientId,
        actorId: input.applicantUserId,
        type: "OPPORTUNITY",
        templateKey: "OPPORTUNITY_APPLICANT_RESPONSE",
        data: { opportunityTitle: input.opportunityTitle },
        href: `/organizations/${input.organizationSlug}/opportunities/applications/${input.applicationId}`,
        dedupeKey: `opportunity-applicant-response:${input.responseKey}:${recipientId}`,
      }),
    ),
  );
}

export async function notifyOpportunityPublisherWithClient(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    organizationSlug: string;
    opportunityId: string;
    opportunityTitle: string;
    actorId: string;
    templateKey: "OPPORTUNITY_PUBLISHED" | "OPPORTUNITY_MODERATION_RESULT";
    outcome?: string;
    dedupeKey: string;
  },
) {
  const memberships = await tx.organizationMembership.findMany({
    where: { organizationId: input.organizationId, status: "ACTIVE" },
    select: { userId: true, role: true, status: true },
  });
  const recipients = memberships
    .filter((membership) =>
      hasOrganizationPermission(membership, "ORGANIZATION_VIEW_OPPORTUNITIES"),
    )
    .map(({ userId }) => userId)
    .filter((userId) => userId !== input.actorId);
  await Promise.all(
    recipients.map((recipientId) =>
      enqueueNotificationJobWithClient(tx, {
        recipientId,
        actorId: input.actorId,
        type: "OPPORTUNITY",
        templateKey: input.templateKey,
        data: {
          opportunityTitle: input.opportunityTitle,
          ...(input.outcome ? { outcome: input.outcome } : {}),
        },
        href: `/organizations/${input.organizationSlug}/opportunities/${input.opportunityId}/edit`,
        dedupeKey: `${input.dedupeKey}:${recipientId}`,
      }),
    ),
  );
}
