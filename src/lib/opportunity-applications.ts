import { Prisma } from "@prisma/client";
import type { OpportunityApplicationStatus } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { OpportunityError } from "@/lib/opportunities";
import {
  applicationAnswersEditable,
  applicationDashboardBucket,
  applicationStatusLabel,
  assertApplicationTransition,
  type OpportunityApplicationActor,
} from "@/lib/opportunity-application-status";
import {
  applicationWindowAcceptsSubmission,
  resolveApplicationWindow,
} from "@/lib/opportunity-application-window";
import {
  notifyApplicationStatusWithClient,
  notifyApplicationSubmittedWithClient,
  notifyApplicantResponseWithClient,
} from "@/lib/opportunity-notifications";
import { serializeOpportunityInterview } from "@/lib/opportunity-interviews";
import { canExposeOpportunityPublicly } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

/**
 * Kondo-hosted application workflow.
 *
 * Two rules dominate this module:
 *   - the deadline and duplicate checks are re-evaluated inside the submission
 *     transaction, so a disabled button is never the thing preventing a late or
 *     duplicate submission;
 *   - a submitted application keeps an immutable snapshot of what was actually
 *     sent, so later profile edits never rewrite history.
 */

export const CONSENT_VERSION = "2026-07-31";

const applicationDetailSelect = {
  id: true,
  status: true,
  submittedAt: true,
  withdrawnAt: true,
  decidedAt: true,
  informationRequestedAt: true,
  informationDueAt: true,
  offerResponseDueAt: true,
  applicantSnapshot: true,
  consentVersion: true,
  createdAt: true,
  updatedAt: true,
  applicantUserId: true,
  organizationId: true,
  opportunity: {
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      lifecycle: true,
      publicationBlockedAt: true,
      publisherType: true,
      expiresAt: true,
      applicationMethod: true,
      applicationOpenAt: true,
      applicationDeadline: true,
      rollingApplications: true,
      timezone: true,
      publisherOrganization: {
        select: {
          id: true,
          slug: true,
          publicName: true,
          lifecycleStatus: true,
          publicProfileBlockedAt: true,
        },
      },
      scholarshipAgent: { select: { isActive: true } },
    },
  },
  answers: {
    select: {
      id: true,
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
      requirementId: true,
      userDocumentId: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      applicantVisibleNote: true,
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
} satisfies Prisma.OpportunityApplicationSelect;

type ApplicationRow = Prisma.OpportunityApplicationGetPayload<{
  select: typeof applicationDetailSelect;
}>;

/**
 * Applicant-facing serialization. Internal reviewer notes are not selected
 * above, so they cannot reach this DTO, a notification or an email.
 */
export function serializeApplicationForApplicant(row: ApplicationRow) {
  return {
    id: row.id,
    status: row.status,
    statusLabel: applicationStatusLabel(row.status),
    bucket: applicationDashboardBucket(row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    informationDueAt: row.informationDueAt?.toISOString() ?? null,
    offerResponseDueAt: row.offerResponseDueAt?.toISOString() ?? null,
    consentVersion: row.consentVersion,
    opportunity: {
      id: row.opportunity.id,
      title: row.opportunity.title,
      type: row.opportunity.type,
      // The link is withheld when the opportunity is no longer public, but the
      // application itself always remains readable.
      href: opportunityStillPublic(row)
        ? `/opportunities/${row.opportunity.slug}`
        : null,
      available: opportunityStillPublic(row),
      organizationName:
        row.opportunity.publisherOrganization?.publicName ?? "Kondo",
    },
    answers: row.answers,
    documents: row.documents.map((document) => ({
      id: document.id,
      userDocumentId: document.userDocumentId,
      category: document.category,
      displayName: document.displayNameSnapshot,
    })),
    timeline: row.statusHistory.map((entry) => ({
      id: entry.id,
      from: entry.fromStatus,
      to: entry.toStatus,
      label: applicationStatusLabel(entry.toStatus),
      note: entry.applicantVisibleNote,
      at: entry.createdAt.toISOString(),
    })),
    interviews: row.interviews.map(serializeOpportunityInterview),
  };
}

function opportunityStillPublic(row: ApplicationRow) {
  return canExposeOpportunityPublicly({
    lifecycle: row.opportunity.lifecycle,
    publisherType: row.opportunity.publisherType,
    publicationBlockedAt: row.opportunity.publicationBlockedAt,
    expiresAt: row.opportunity.expiresAt,
    organizationLifecycleStatus:
      row.opportunity.publisherOrganization?.lifecycleStatus ?? null,
    organizationPublicProfileBlockedAt:
      row.opportunity.publisherOrganization?.publicProfileBlockedAt ?? null,
    legacyAgentActive: row.opportunity.scholarshipAgent?.isActive ?? null,
    scope: "HISTORICAL",
  });
}

export async function startApplication(input: {
  userId: string;
  opportunityId: string;
}) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: {
      id: true,
      title: true,
      type: true,
      lifecycle: true,
      publicationBlockedAt: true,
      publisherType: true,
      publisherOrganizationId: true,
      expiresAt: true,
      applicationMethod: true,
      applicationOpenAt: true,
      applicationDeadline: true,
      rollingApplications: true,
      timezone: true,
      publisherOrganization: {
        select: {
          slug: true,
          lifecycleStatus: true,
          publicProfileBlockedAt: true,
        },
      },
      scholarshipAgent: { select: { isActive: true } },
    },
  });
  if (!opportunity) throw new OpportunityError("Opportunity not found.", 404);

  const visible = canExposeOpportunityPublicly({
    lifecycle: opportunity.lifecycle,
    publisherType: opportunity.publisherType,
    publicationBlockedAt: opportunity.publicationBlockedAt,
    expiresAt: opportunity.expiresAt,
    organizationLifecycleStatus:
      opportunity.publisherOrganization?.lifecycleStatus ?? null,
    organizationPublicProfileBlockedAt:
      opportunity.publisherOrganization?.publicProfileBlockedAt ?? null,
    legacyAgentActive: opportunity.scholarshipAgent?.isActive ?? null,
  });
  if (!visible) throw new OpportunityError("Opportunity not found.", 404);

  const window = resolveApplicationWindow({
    lifecycle: opportunity.lifecycle,
    applicationMethod: opportunity.applicationMethod,
    applicationOpenAt: opportunity.applicationOpenAt,
    applicationDeadline: opportunity.applicationDeadline,
    rollingApplications: opportunity.rollingApplications,
    timezone: opportunity.timezone,
  });
  if (!applicationWindowAcceptsSubmission(window)) {
    throw new OpportunityError(
      "This opportunity does not accept applications through Kondo.",
      409,
    );
  }

  // The unique constraint on (opportunityId, applicantUserId) is the real
  // guard; the upsert simply returns the existing draft instead of failing.
  const application = await prisma.opportunityApplication.upsert({
    where: {
      opportunityId_applicantUserId: {
        opportunityId: opportunity.id,
        applicantUserId: input.userId,
      },
    },
    create: {
      opportunityId: opportunity.id,
      applicantUserId: input.userId,
      organizationId: opportunity.publisherOrganizationId,
      status: "DRAFT",
    },
    update: {},
    select: applicationDetailSelect,
  });

  await Promise.all([
    trackEvent({
      name: "OPPORTUNITY_APPLICATION_STARTED",
      userId: input.userId,
      properties: { opportunityType: opportunity.type },
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event: PRODUCT_EVENTS.OPPORTUNITY_APPLICATION_STARTED,
      properties: { opportunity_type: opportunity.type },
    }),
  ]);

  return serializeApplicationForApplicant(application);
}

export async function saveApplicationDraft(input: {
  userId: string;
  applicationId: string;
  answers?: readonly {
    questionId: string;
    answerText?: string | null;
    answerStructured?: Prisma.InputJsonValue | null;
  }[];
  documentIds?: readonly string[];
}) {
  const application = await prisma.opportunityApplication.findFirst({
    where: { id: input.applicationId, applicantUserId: input.userId },
    select: {
      id: true,
      status: true,
      opportunityId: true,
      opportunity: {
        select: {
          questions: { select: { id: true } },
          requirements: { select: { id: true, documentType: true } },
        },
      },
    },
  });
  if (!application) throw new OpportunityError("Application not found.", 404);
  if (!applicationAnswersEditable(application.status)) {
    throw new OpportunityError(
      "This application can no longer be edited.",
      409,
    );
  }

  const questionIds = new Set(
    application.opportunity.questions.map(({ id }) => id),
  );

  await prisma.$transaction(async (tx) => {
    for (const answer of input.answers ?? []) {
      // An answer to a question that does not belong to this opportunity is
      // rejected rather than silently stored.
      if (!questionIds.has(answer.questionId)) {
        throw new OpportunityError("Unknown application question.", 400);
      }
      await tx.opportunityApplicationAnswer.upsert({
        where: {
          applicationId_questionId: {
            applicationId: application.id,
            questionId: answer.questionId,
          },
        },
        create: {
          applicationId: application.id,
          questionId: answer.questionId,
          answerText: answer.answerText ?? null,
          answerStructured: answer.answerStructured ?? Prisma.DbNull,
        },
        update: {
          answerText: answer.answerText ?? null,
          answerStructured: answer.answerStructured ?? Prisma.DbNull,
        },
      });
    }

    if (input.documentIds) {
      // Only the applicant's own, non-archived documents may be attached.
      const documents = await tx.userOpportunityDocument.findMany({
        where: {
          id: { in: [...input.documentIds] },
          userId: input.userId,
          archivedAt: null,
          media: { status: "ACTIVE", scanStatus: "CLEAN" },
        },
        select: { id: true, category: true, displayName: true },
      });
      if (documents.length !== new Set(input.documentIds).size) {
        throw new OpportunityError("Select your own uploaded documents.", 400);
      }
      await tx.opportunityApplicationDocument.deleteMany({
        where: { applicationId: application.id },
      });
      for (const document of documents) {
        await tx.opportunityApplicationDocument.create({
          data: {
            applicationId: application.id,
            userDocumentId: document.id,
            category: document.category,
            displayNameSnapshot: document.displayName,
            requirementId:
              application.opportunity.requirements.find(
                (requirement) => requirement.documentType === document.category,
              )?.id ?? null,
          },
        });
      }
    }
  });

  await trackEvent({
    name: "OPPORTUNITY_APPLICATION_DRAFT_SAVED",
    userId: input.userId,
    properties: {},
  });

  const refreshed = await prisma.opportunityApplication.findUniqueOrThrow({
    where: { id: application.id },
    select: applicationDetailSelect,
  });
  return serializeApplicationForApplicant(refreshed);
}

const submissionSelect = {
  id: true,
  status: true,
  organizationId: true,
  opportunity: {
    select: {
      id: true,
      title: true,
      type: true,
      slug: true,
      lifecycle: true,
      publicationBlockedAt: true,
      publisherType: true,
      expiresAt: true,
      applicationMethod: true,
      applicationOpenAt: true,
      applicationDeadline: true,
      rollingApplications: true,
      timezone: true,
      publisherOrganization: {
        select: {
          slug: true,
          lifecycleStatus: true,
          publicProfileBlockedAt: true,
        },
      },
      scholarshipAgent: { select: { isActive: true } },
      questions: { select: { id: true, required: true } },
      requirements: {
        select: { id: true, documentType: true, required: true },
      },
    },
  },
  answers: {
    select: { questionId: true, answerText: true, answerStructured: true },
  },
  documents: { select: { category: true } },
  applicantUser: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      studyLevel: true,
      degree: true,
      university: { select: { name: true } },
      city: { select: { name: true } },
      country: { select: { name: true } },
    },
  },
} satisfies Prisma.OpportunityApplicationSelect;

/**
 * Submission. Everything that could have changed while the applicant was
 * editing — the deadline, the lifecycle, the organization's state, the required
 * answers and documents — is re-checked inside the transaction. A late
 * submission is refused but the draft is preserved.
 */
export async function submitApplication(input: {
  userId: string;
  applicationId: string;
  consentAccepted: boolean;
  now?: Date;
}) {
  if (!input.consentAccepted) {
    throw new OpportunityError(
      "Confirm the information you are sharing before submitting.",
      400,
    );
  }
  const now = input.now ?? new Date();

  const result = await prisma.$transaction(async (tx) => {
    const application = await tx.opportunityApplication.findFirst({
      where: { id: input.applicationId, applicantUserId: input.userId },
      select: submissionSelect,
    });
    if (!application) throw new OpportunityError("Application not found.", 404);
    if (application.status !== "DRAFT") {
      throw new OpportunityError(
        "This application was already submitted.",
        409,
      );
    }
    if (application.applicantUser.status !== "ACTIVE") {
      throw new OpportunityError(
        "Your account cannot submit applications.",
        403,
      );
    }

    const opportunity = application.opportunity;
    const visible = canExposeOpportunityPublicly({
      lifecycle: opportunity.lifecycle,
      publisherType: opportunity.publisherType,
      publicationBlockedAt: opportunity.publicationBlockedAt,
      expiresAt: opportunity.expiresAt,
      organizationLifecycleStatus:
        opportunity.publisherOrganization?.lifecycleStatus ?? null,
      organizationPublicProfileBlockedAt:
        opportunity.publisherOrganization?.publicProfileBlockedAt ?? null,
      legacyAgentActive: opportunity.scholarshipAgent?.isActive ?? null,
      now,
    });
    if (!visible) {
      throw new OpportunityError(
        "This opportunity is no longer accepting applications. Your draft is saved.",
        409,
      );
    }

    const window = resolveApplicationWindow({
      lifecycle: opportunity.lifecycle,
      applicationMethod: opportunity.applicationMethod,
      applicationOpenAt: opportunity.applicationOpenAt,
      applicationDeadline: opportunity.applicationDeadline,
      rollingApplications: opportunity.rollingApplications,
      timezone: opportunity.timezone,
      now,
    });
    if (!applicationWindowAcceptsSubmission(window)) {
      throw new OpportunityError(
        "The application deadline has passed. Your draft is saved.",
        409,
      );
    }

    const answered = new Map(
      application.answers.map((answer) => [answer.questionId, answer]),
    );
    for (const question of opportunity.questions) {
      if (!question.required) continue;
      const answer = answered.get(question.id);
      const hasText = Boolean(answer?.answerText?.trim());
      const hasStructured =
        answer?.answerStructured !== null &&
        answer?.answerStructured !== undefined;
      if (!hasText && !hasStructured) {
        throw new OpportunityError("Answer every required question.", 400);
      }
    }

    const attachedCategories = new Set(
      application.documents.map((document) => document.category),
    );
    for (const requirement of opportunity.requirements) {
      if (
        requirement.required &&
        !attachedCategories.has(requirement.documentType)
      ) {
        throw new OpportunityError("Attach every required document.", 400);
      }
    }

    const applicant = application.applicantUser;
    // Immutable record of what was actually shared, so later profile edits
    // cannot rewrite the submission.
    const snapshot = {
      name: `${applicant.firstName} ${applicant.lastName}`.trim(),
      email: applicant.email,
      studyLevel: applicant.studyLevel,
      degree: applicant.degree,
      university: applicant.university?.name ?? null,
      city: applicant.city?.name ?? null,
      country: applicant.country?.name ?? null,
      submittedAt: now.toISOString(),
    } satisfies Prisma.InputJsonObject;

    const updated = await tx.opportunityApplication.update({
      where: { id: application.id },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        applicantSnapshot: snapshot,
        consentVersion: CONSENT_VERSION,
      },
      select: { id: true, status: true },
    });

    await tx.opportunityApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: "DRAFT",
        toStatus: "SUBMITTED",
        actingUserId: input.userId,
        applicantVisibleNote: "Application submitted.",
      },
    });

    await notifyApplicationSubmittedWithClient(tx, {
      applicationId: application.id,
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      applicantUserId: input.userId,
      organizationId: application.organizationId,
      organizationSlug: opportunity.publisherOrganization?.slug ?? null,
    });

    return {
      updated,
      opportunityType: opportunity.type,
      opportunityId: opportunity.id,
    };
  });

  await Promise.all([
    trackEvent({
      name: "OPPORTUNITY_APPLICATION_SUBMITTED",
      userId: input.userId,
      properties: { opportunityType: result.opportunityType },
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event: PRODUCT_EVENTS.OPPORTUNITY_APPLICATION_SUBMITTED,
      properties: { opportunity_type: result.opportunityType },
    }),
    writeAuditLog({
      actorId: input.userId,
      action: "OPPORTUNITY_APPLICATION_SUBMITTED",
      entityType: "OpportunityApplication",
      entityId: result.updated.id,
    }),
  ]);

  return { id: result.updated.id, status: result.updated.status };
}

export async function withdrawApplication(input: {
  userId: string;
  applicationId: string;
}) {
  const application = await prisma.opportunityApplication.findFirst({
    where: { id: input.applicationId, applicantUserId: input.userId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      opportunity: {
        select: {
          title: true,
          publisherOrganization: { select: { slug: true } },
        },
      },
    },
  });
  if (!application) throw new OpportunityError("Application not found.", 404);
  assertApplicationTransition({
    actor: "APPLICANT",
    from: application.status,
    to: "WITHDRAWN",
  });

  await prisma.$transaction(async (tx) => {
    await tx.opportunityApplication.update({
      where: { id: application.id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
    const history = await tx.opportunityApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: "WITHDRAWN",
        actingUserId: input.userId,
        applicantVisibleNote: "You withdrew this application.",
      },
      select: { id: true },
    });
    if (
      application.organizationId &&
      application.opportunity.publisherOrganization?.slug
    ) {
      await notifyApplicantResponseWithClient(tx, {
        applicationId: application.id,
        organizationId: application.organizationId,
        organizationSlug: application.opportunity.publisherOrganization.slug,
        applicantUserId: input.userId,
        opportunityTitle: application.opportunity.title,
        responseKey: history.id,
      });
    }
  });

  await trackEvent({
    name: "OPPORTUNITY_APPLICATION_WITHDRAWN",
    userId: input.userId,
    properties: {},
  });
  return { status: "WITHDRAWN" as const };
}

export async function respondToOfferDecision(input: {
  userId: string;
  applicationId: string;
  decision: "ACCEPTED" | "DECLINED_BY_APPLICANT";
}) {
  const application = await prisma.opportunityApplication.findFirst({
    where: { id: input.applicationId, applicantUserId: input.userId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      opportunity: {
        select: {
          title: true,
          publisherOrganization: { select: { slug: true } },
        },
      },
    },
  });
  if (!application) throw new OpportunityError("Application not found.", 404);
  assertApplicationTransition({
    actor: "APPLICANT",
    from: application.status,
    to: input.decision,
  });

  await prisma.$transaction(async (tx) => {
    await tx.opportunityApplication.update({
      where: { id: application.id },
      data: { status: input.decision, decidedAt: new Date() },
    });
    const history = await tx.opportunityApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: input.decision,
        actingUserId: input.userId,
        applicantVisibleNote:
          input.decision === "ACCEPTED"
            ? "You accepted this offer."
            : "You declined this offer.",
      },
      select: { id: true },
    });
    if (
      application.organizationId &&
      application.opportunity.publisherOrganization?.slug
    ) {
      await notifyApplicantResponseWithClient(tx, {
        applicationId: application.id,
        organizationId: application.organizationId,
        organizationSlug: application.opportunity.publisherOrganization.slug,
        applicantUserId: input.userId,
        opportunityTitle: application.opportunity.title,
        responseKey: history.id,
      });
    }
  });
  await writeAuditLog({
    actorId: input.userId,
    action: `OPPORTUNITY_OFFER_${input.decision}`,
    entityType: "OpportunityApplication",
    entityId: application.id,
  });
  return { status: input.decision };
}

export async function respondToInformationRequest(input: {
  userId: string;
  applicationId: string;
}) {
  const application = await prisma.opportunityApplication.findFirst({
    where: { id: input.applicationId, applicantUserId: input.userId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      opportunity: {
        select: {
          title: true,
          publisherOrganization: { select: { slug: true } },
        },
      },
    },
  });
  if (!application) throw new OpportunityError("Application not found.", 404);
  assertApplicationTransition({
    actor: "APPLICANT",
    from: application.status,
    to: "UNDER_REVIEW",
  });

  await prisma.$transaction(async (tx) => {
    await tx.opportunityApplication.update({
      where: { id: application.id },
      data: { status: "UNDER_REVIEW", informationDueAt: null },
    });
    const history = await tx.opportunityApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: "UNDER_REVIEW",
        actingUserId: input.userId,
        applicantVisibleNote: "You sent the requested information.",
      },
      select: { id: true },
    });
    if (
      application.organizationId &&
      application.opportunity.publisherOrganization?.slug
    ) {
      await notifyApplicantResponseWithClient(tx, {
        applicationId: application.id,
        organizationId: application.organizationId,
        organizationSlug: application.opportunity.publisherOrganization.slug,
        applicantUserId: input.userId,
        opportunityTitle: application.opportunity.title,
        responseKey: history.id,
      });
    }
  });
  await writeAuditLog({
    actorId: input.userId,
    action: "OPPORTUNITY_INFORMATION_RESPONSE_SUBMITTED",
    entityType: "OpportunityApplication",
    entityId: application.id,
  });
  return { status: "UNDER_REVIEW" as const };
}

export async function listApplicationsForApplicant(userId: string) {
  const rows = await prisma.opportunityApplication.findMany({
    where: { applicantUserId: userId },
    select: applicationDetailSelect,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return rows.map(serializeApplicationForApplicant);
}

export async function getApplicationForApplicant(input: {
  userId: string;
  applicationId: string;
}) {
  const row = await prisma.opportunityApplication.findFirst({
    where: { id: input.applicationId, applicantUserId: input.userId },
    select: applicationDetailSelect,
  });
  if (!row) return null;
  return serializeApplicationForApplicant(row);
}

/** Shared status-change entry point used by organization reviewers. */
export async function changeApplicationStatus(input: {
  actorUserId: string;
  actor: OpportunityApplicationActor;
  applicationId: string;
  toStatus: OpportunityApplicationStatus;
  applicantVisibleNote?: string | null;
  internalNote?: string | null;
  informationDueAt?: Date | null;
  offerResponseDueAt?: Date | null;
}) {
  const application = await prisma.opportunityApplication.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      status: true,
      applicantUserId: true,
      organizationId: true,
      opportunity: { select: { title: true } },
    },
  });
  if (!application) throw new OpportunityError("Application not found.", 404);
  assertApplicationTransition({
    actor: input.actor,
    from: application.status,
    to: input.toStatus,
  });

  await prisma.$transaction(async (tx) => {
    await tx.opportunityApplication.update({
      where: { id: application.id },
      data: {
        status: input.toStatus,
        informationRequestedAt:
          input.toStatus === "MORE_INFORMATION_REQUIRED"
            ? new Date()
            : undefined,
        informationDueAt: input.informationDueAt ?? undefined,
        offerResponseDueAt: input.offerResponseDueAt ?? undefined,
        decidedAt:
          input.toStatus === "REJECTED" || input.toStatus === "OFFERED"
            ? new Date()
            : undefined,
      },
    });
    const history = await tx.opportunityApplicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: application.status,
        toStatus: input.toStatus,
        actingUserId: input.actorUserId,
        // Kept in separate columns: the internal note is never rendered to the
        // applicant, emailed, or included in analytics.
        applicantVisibleNote: input.applicantVisibleNote?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
      },
      select: { id: true },
    });
    await notifyApplicationStatusWithClient(tx, {
      applicationId: application.id,
      applicantUserId: application.applicantUserId,
      actorId: input.actorUserId,
      opportunityTitle: application.opportunity.title,
      status: input.toStatus,
      historyId: history.id,
    });
  });

  await writeAuditLog({
    actorId: input.actorUserId,
    action: "OPPORTUNITY_APPLICATION_STATUS_CHANGED",
    entityType: "OpportunityApplication",
    entityId: application.id,
    newValue: { status: input.toStatus },
  });

  return {
    status: input.toStatus,
    applicantUserId: application.applicantUserId,
  };
}
