import { Prisma } from "@prisma/client";
import type { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import type {
  opportunityDraftSchema,
  jobDetailSchema,
  opportunityAuthoringSchema,
  scholarshipDetailSchema,
} from "@/features/opportunities/schemas";
import { OpportunityError } from "@/lib/opportunities";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
import { notifyOpportunityPublisherWithClient } from "@/lib/opportunity-notifications";
import { assertOpportunityTransition } from "@/lib/opportunity-lifecycle";
import {
  requireOpportunityPublisher,
  OpportunityAccessError,
} from "@/lib/opportunity-permissions";
import {
  canChangeOpportunityType,
  opportunitySupportsApplicationMethod,
  opportunitySupportsPublisher,
  opportunityTypeDefinition,
} from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

/**
 * Organization-side opportunity authoring and publishing.
 *
 * Every mutation re-resolves capability + permission + organization lifecycle
 * through requireOpportunityPublisher; none of them trusts a client-supplied
 * publisher, lifecycle or moderation field.
 */

type DraftInput = z.infer<typeof opportunityDraftSchema>;
type ScholarshipInput = z.infer<typeof scholarshipDetailSchema>;
type JobInput = z.infer<typeof jobDetailSchema>;
type AuthoringInput = z.infer<typeof opportunityAuthoringSchema>;
type AuthoringRelations = Omit<AuthoringInput, "draft" | "scholarship" | "job">;

async function uniqueSlug(title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "opportunity";
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.opportunity.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function assertMethodSupported(input: DraftInput) {
  if (
    !opportunitySupportsApplicationMethod(input.type, input.applicationMethod)
  ) {
    throw new OpportunityError(
      "This application method is not available for this opportunity type.",
      400,
    );
  }
}

export async function createOrganizationOpportunity(
  input: {
    userId: string;
    organizationId: string;
    draft: DraftInput;
    scholarship?: ScholarshipInput | null;
    job?: JobInput | null;
  } & AuthoringRelations,
) {
  assertMethodSupported(input.draft);
  if (!opportunitySupportsPublisher(input.draft.type, "ORGANIZATION")) {
    throw new OpportunityError(
      "Organizations cannot publish this opportunity type.",
      400,
    );
  }

  const context = await requireOpportunityPublisher({
    userId: input.userId,
    organizationId: input.organizationId,
    type: input.draft.type,
    permission: "ORGANIZATION_CREATE_OPPORTUNITIES",
  });

  const definition = opportunityTypeDefinition(input.draft.type);
  const slug = await uniqueSlug(input.draft.title);

  const created = await prisma.opportunity.create({
    data: {
      slug,
      type: input.draft.type,
      // A new record always starts as a DRAFT; the client cannot seed a
      // published or moderated state.
      lifecycle: "DRAFT",
      publisherType: "ORGANIZATION",
      publisherOrganizationId: input.organizationId,
      createdByUserId: input.userId,
      title: input.draft.title,
      shortDescription: input.draft.shortDescription,
      description: input.draft.description,
      countryId: input.draft.countryId ?? null,
      cityId: input.draft.cityId ?? null,
      universityId: input.draft.universityId ?? null,
      locationLabel: input.draft.locationLabel ?? null,
      workMode: input.draft.workMode,
      applicationMethod: input.draft.applicationMethod,
      externalApplicationUrl: input.draft.externalApplicationUrl ?? null,
      applicationEmail: input.draft.applicationEmail ?? null,
      officialSourceUrl: input.draft.officialSourceUrl ?? null,
      applicationOpenAt: input.draft.applicationOpenAt ?? null,
      applicationDeadline: input.draft.applicationDeadline ?? null,
      rollingApplications: input.draft.rollingApplications,
      expectedDecisionDate: input.draft.expectedDecisionDate ?? null,
      opportunityStartDate: input.draft.opportunityStartDate ?? null,
      opportunityEndDate: input.draft.opportunityEndDate ?? null,
      timezone: input.draft.timezone,
      degreeLevels: {
        create: input.draft.degreeLevels.map((degreeLevel) => ({
          degreeLevel: degreeLevel as never,
        })),
      },
      fieldsOfStudy: {
        create: input.draft.fieldsOfStudy.map((fieldKey) => ({ fieldKey })),
      },
      eligibilityRules: {
        create: (input.eligibilityRules ?? []).map((rule) => ({
          ...rule,
          structuredValue: rule.structuredValue as Prisma.InputJsonValue,
        })),
      },
      benefits: { create: input.benefits ?? [] },
      requirements: { create: input.requirements ?? [] },
      questions: {
        create: (input.questions ?? []).map((question) => ({
          ...question,
          options: question.options ?? undefined,
        })),
      },
      languageRequirements: {
        create: input.languageRequirements ?? [],
      },
      ...(definition.detail === "scholarship" && input.scholarship
        ? { scholarshipDetail: { create: input.scholarship } }
        : {}),
      ...(definition.detail === "job" && input.job
        ? { jobDetail: { create: input.job } }
        : {}),
    },
    select: { id: true, slug: true },
  });

  await Promise.all([
    trackEvent({
      name: "ORGANIZATION_OPPORTUNITY_CREATED",
      userId: input.userId,
      properties: { opportunityType: input.draft.type },
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event: PRODUCT_EVENTS.ORGANIZATION_OPPORTUNITY_CREATED,
      properties: { opportunity_type: input.draft.type },
    }),
    writeAuditLog({
      actorId: input.userId,
      organizationId: input.organizationId,
      action: "OPPORTUNITY_CREATED",
      entityType: "Opportunity",
      entityId: created.id,
    }),
  ]);

  revalidateOpportunity({
    opportunityId: created.id,
    slug: created.slug,
    organizationSlug: context.organization.slug,
  });
  return created;
}

async function loadOwnedOpportunity(input: {
  opportunityId: string;
  organizationId: string;
}) {
  const opportunity = await prisma.opportunity.findFirst({
    where: {
      id: input.opportunityId,
      // Scoping by organization is what prevents one organization from editing
      // another organization's opportunity through a guessed id.
      publisherOrganizationId: input.organizationId,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      lifecycle: true,
      publisherOrganizationId: true,
      _count: { select: { applications: true } },
    },
  });
  if (!opportunity) {
    throw new OpportunityAccessError("Opportunity not found.", 404);
  }
  return opportunity;
}

async function assertOpportunityReadyToPublish(opportunityId: string) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    select: {
      type: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      applicationEmail: true,
      officialSourceUrl: true,
      scholarshipDetail: { select: { opportunityId: true } },
      jobDetail: { select: { opportunityId: true } },
    },
  });
  if (!opportunity) throw new OpportunityError("Opportunity not found.", 404);
  const definition = opportunityTypeDefinition(opportunity.type);
  if (definition.detail === "scholarship" && !opportunity.scholarshipDetail) {
    throw new OpportunityError(
      "Complete the scholarship funding details before publishing.",
      400,
    );
  }
  if (definition.detail === "job" && !opportunity.jobDetail) {
    throw new OpportunityError(
      "Complete the role and compensation details before publishing.",
      400,
    );
  }
  if (
    opportunity.applicationMethod === "EXTERNAL_URL" &&
    (!opportunity.externalApplicationUrl || !opportunity.officialSourceUrl)
  ) {
    throw new OpportunityError(
      "Add both the official source and application links before publishing.",
      400,
    );
  }
  if (
    opportunity.applicationMethod === "EMAIL" &&
    !opportunity.applicationEmail
  ) {
    throw new OpportunityError(
      "Add the professional application email before publishing.",
      400,
    );
  }
}

export async function updateOrganizationOpportunity(
  input: {
    userId: string;
    organizationId: string;
    opportunityId: string;
    draft: DraftInput;
    scholarship?: ScholarshipInput | null;
    job?: JobInput | null;
  } & AuthoringRelations,
) {
  assertMethodSupported(input.draft);
  const existing = await loadOwnedOpportunity(input);

  const context = await requireOpportunityPublisher({
    userId: input.userId,
    organizationId: input.organizationId,
    type: existing.type,
    permission: "ORGANIZATION_EDIT_OPPORTUNITIES",
  });

  if (
    !canChangeOpportunityType({
      from: existing.type,
      to: input.draft.type,
      hasApplications: existing._count.applications > 0,
    })
  ) {
    throw new OpportunityError(
      "This opportunity already has applications and cannot change to an incompatible type.",
      409,
    );
  }

  const definition = opportunityTypeDefinition(input.draft.type);

  if (
    existing._count.applications > 0 &&
    (input.questions !== undefined || input.requirements !== undefined)
  ) {
    throw new OpportunityError(
      "Application questions and required documents are locked after an application starts.",
      409,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.opportunityDegreeLevel.deleteMany({
      where: { opportunityId: existing.id },
    });
    await tx.opportunityFieldOfStudy.deleteMany({
      where: { opportunityId: existing.id },
    });
    if (input.eligibilityRules !== undefined) {
      await tx.opportunityEligibilityRule.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    if (input.benefits !== undefined) {
      await tx.opportunityBenefit.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    if (input.languageRequirements !== undefined) {
      await tx.opportunityLanguageRequirement.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    if (input.requirements !== undefined) {
      await tx.opportunityApplicationRequirement.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    if (input.questions !== undefined) {
      await tx.opportunityApplicationQuestion.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    await tx.opportunity.update({
      where: { id: existing.id },
      data: {
        type: input.draft.type,
        title: input.draft.title,
        shortDescription: input.draft.shortDescription,
        description: input.draft.description,
        countryId: input.draft.countryId ?? null,
        cityId: input.draft.cityId ?? null,
        universityId: input.draft.universityId ?? null,
        locationLabel: input.draft.locationLabel ?? null,
        workMode: input.draft.workMode,
        applicationMethod: input.draft.applicationMethod,
        externalApplicationUrl: input.draft.externalApplicationUrl ?? null,
        applicationEmail: input.draft.applicationEmail ?? null,
        officialSourceUrl: input.draft.officialSourceUrl ?? null,
        applicationOpenAt: input.draft.applicationOpenAt ?? null,
        applicationDeadline: input.draft.applicationDeadline ?? null,
        rollingApplications: input.draft.rollingApplications,
        expectedDecisionDate: input.draft.expectedDecisionDate ?? null,
        opportunityStartDate: input.draft.opportunityStartDate ?? null,
        opportunityEndDate: input.draft.opportunityEndDate ?? null,
        timezone: input.draft.timezone,
        degreeLevels: {
          create: input.draft.degreeLevels.map((degreeLevel) => ({
            degreeLevel: degreeLevel as never,
          })),
        },
        fieldsOfStudy: {
          create: input.draft.fieldsOfStudy.map((fieldKey) => ({ fieldKey })),
        },
        ...(input.eligibilityRules !== undefined
          ? {
              eligibilityRules: {
                create: input.eligibilityRules.map((rule) => ({
                  ...rule,
                  structuredValue:
                    rule.structuredValue as Prisma.InputJsonValue,
                })),
              },
            }
          : {}),
        ...(input.benefits !== undefined
          ? { benefits: { create: input.benefits } }
          : {}),
        ...(input.requirements !== undefined
          ? { requirements: { create: input.requirements } }
          : {}),
        ...(input.questions !== undefined
          ? {
              questions: {
                create: input.questions.map((question) => ({
                  ...question,
                  options: question.options ?? undefined,
                })),
              },
            }
          : {}),
        ...(input.languageRequirements !== undefined
          ? {
              languageRequirements: {
                create: input.languageRequirements,
              },
            }
          : {}),
      },
    });

    if (definition.detail === "scholarship" && input.scholarship) {
      await tx.opportunityScholarshipDetail.upsert({
        where: { opportunityId: existing.id },
        create: { opportunityId: existing.id, ...input.scholarship },
        update: input.scholarship,
      });
      await tx.opportunityJobDetail.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
    if (definition.detail === "job" && input.job) {
      await tx.opportunityJobDetail.upsert({
        where: { opportunityId: existing.id },
        create: { opportunityId: existing.id, ...input.job },
        update: input.job,
      });
      await tx.opportunityScholarshipDetail.deleteMany({
        where: { opportunityId: existing.id },
      });
    }
  });

  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: "OPPORTUNITY_UPDATED",
    entityType: "Opportunity",
    entityId: existing.id,
  });
  revalidateOpportunity({
    opportunityId: existing.id,
    slug: existing.slug,
    organizationSlug: context.organization.slug,
  });
  return { id: existing.id, slug: existing.slug };
}

/** Publisher-side lifecycle actions: submit, publish, pause, close, archive. */
export async function transitionOrganizationOpportunity(input: {
  userId: string;
  organizationId: string;
  opportunityId: string;
  action: "SUBMIT" | "PUBLISH" | "PAUSE" | "CLOSE" | "ARCHIVE";
}) {
  const existing = await loadOwnedOpportunity(input);

  if (input.action === "PUBLISH" || input.action === "SUBMIT") {
    await assertOpportunityReadyToPublish(existing.id);
  }

  const permission =
    input.action === "SUBMIT"
      ? "ORGANIZATION_SUBMIT_OPPORTUNITIES"
      : input.action === "ARCHIVE"
        ? "ORGANIZATION_ARCHIVE_OPPORTUNITIES"
        : "ORGANIZATION_PUBLISH_OPPORTUNITIES";

  const context = await requireOpportunityPublisher({
    userId: input.userId,
    organizationId: input.organizationId,
    type: existing.type,
    permission,
    // Publishing re-checks the organization lifecycle so a suspension takes
    // effect immediately, including for an already-drafted opportunity.
    requiresPublishing: input.action === "PUBLISH" || input.action === "SUBMIT",
  });

  const target =
    input.action === "SUBMIT"
      ? "PENDING_REVIEW"
      : input.action === "PUBLISH"
        ? "PUBLISHED"
        : input.action === "PAUSE"
          ? "PAUSED"
          : input.action === "CLOSE"
            ? "CLOSED"
            : "ARCHIVED";

  assertOpportunityTransition({
    actor: "PUBLISHER",
    from: existing.lifecycle,
    to: target,
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: existing.id },
      data: {
        lifecycle: target,
        submittedAt: target === "PENDING_REVIEW" ? now : undefined,
        publishedAt: target === "PUBLISHED" ? now : undefined,
        closedAt: target === "CLOSED" ? now : undefined,
        archivedAt: target === "ARCHIVED" ? now : undefined,
      },
    });
    if (target === "PUBLISHED") {
      await notifyOpportunityPublisherWithClient(tx, {
        organizationId: input.organizationId,
        organizationSlug: context.organization.slug,
        opportunityId: existing.id,
        opportunityTitle: existing.title,
        actorId: input.userId,
        templateKey: "OPPORTUNITY_PUBLISHED",
        dedupeKey: `opportunity-published:${existing.id}:${now.toISOString()}`,
      });
    }
  });

  if (target === "PENDING_REVIEW" || target === "PUBLISHED") {
    const eventName =
      target === "PUBLISHED"
        ? ("ORGANIZATION_OPPORTUNITY_PUBLISHED" as const)
        : ("ORGANIZATION_OPPORTUNITY_SUBMITTED" as const);
    await trackEvent({
      name: eventName,
      userId: input.userId,
      properties: { opportunityType: existing.type },
    });
  }

  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: `OPPORTUNITY_${input.action}`,
    entityType: "Opportunity",
    entityId: existing.id,
    oldValue: { lifecycle: existing.lifecycle },
    newValue: { lifecycle: target },
  });

  revalidateOpportunity({
    opportunityId: existing.id,
    slug: existing.slug,
    organizationSlug: context.organization.slug,
  });
  return { lifecycle: target };
}

/** Workspace listing for the organization's own opportunities. */
export async function listOrganizationOpportunities(input: {
  userId: string;
  organizationId: string;
}) {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new OpportunityAccessError("You do not have workspace access.", 403);
  }

  const rows = await prisma.opportunity.findMany({
    where: { publisherOrganizationId: input.organizationId },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      lifecycle: true,
      applicationDeadline: true,
      publishedAt: true,
      updatedAt: true,
      // Counts only — no applicant data reaches the workspace list.
      _count: { select: { applications: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    type: row.type,
    typeLabel: opportunityTypeDefinition(row.type).label,
    lifecycle: row.lifecycle,
    deadline: row.applicationDeadline?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    applicationCount: row._count.applications,
  }));
}

export async function getOrganizationOpportunityForEdit(input: {
  userId: string;
  organizationId: string;
  opportunityId: string;
}) {
  const owned = await loadOwnedOpportunity(input);
  await requireOpportunityPublisher({
    userId: input.userId,
    organizationId: input.organizationId,
    type: owned.type,
    permission: "ORGANIZATION_EDIT_OPPORTUNITIES",
  });
  const row = await prisma.opportunity.findUniqueOrThrow({
    where: { id: owned.id },
    select: {
      id: true,
      slug: true,
      type: true,
      lifecycle: true,
      title: true,
      shortDescription: true,
      description: true,
      countryId: true,
      cityId: true,
      universityId: true,
      locationLabel: true,
      workMode: true,
      applicationMethod: true,
      externalApplicationUrl: true,
      applicationEmail: true,
      officialSourceUrl: true,
      applicationOpenAt: true,
      applicationDeadline: true,
      rollingApplications: true,
      expectedDecisionDate: true,
      opportunityStartDate: true,
      opportunityEndDate: true,
      timezone: true,
      degreeLevels: { select: { degreeLevel: true } },
      fieldsOfStudy: { select: { fieldKey: true } },
      eligibilityRules: {
        select: {
          ruleType: true,
          operator: true,
          structuredValue: true,
          required: true,
          publicLabel: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      benefits: {
        select: {
          type: true,
          amountMinor: true,
          currency: true,
          period: true,
          description: true,
          confidence: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      requirements: {
        select: {
          documentType: true,
          required: true,
          description: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      questions: {
        select: {
          type: true,
          label: true,
          description: true,
          required: true,
          options: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      languageRequirements: {
        select: {
          language: true,
          level: true,
          certificateType: true,
          required: true,
        },
      },
      scholarshipDetail: true,
      jobDetail: true,
      media: {
        where: { isCover: true },
        select: { mediaId: true, altText: true },
        take: 1,
      },
      _count: { select: { applications: true } },
    },
  });
  const { _count, ...editable } = row;
  return {
    ...editable,
    applicationOpenAt: row.applicationOpenAt?.toISOString() ?? null,
    applicationDeadline: row.applicationDeadline?.toISOString() ?? null,
    expectedDecisionDate:
      row.expectedDecisionDate?.toISOString().slice(0, 10) ?? null,
    opportunityStartDate:
      row.opportunityStartDate?.toISOString().slice(0, 10) ?? null,
    opportunityEndDate:
      row.opportunityEndDate?.toISOString().slice(0, 10) ?? null,
    degreeLevels: row.degreeLevels.map(({ degreeLevel }) => degreeLevel),
    fieldsOfStudy: row.fieldsOfStudy.map(({ fieldKey }) => fieldKey),
    applicationCount: _count.applications,
  };
}

export async function expireOpportunities(now = new Date()) {
  const expired = await prisma.opportunity.updateMany({
    where: {
      lifecycle: "PUBLISHED",
      applicationDeadline: { lt: now },
      rollingApplications: false,
    },
    data: { lifecycle: "EXPIRED", expiresAt: now },
  });
  if (expired.count > 0) revalidateOpportunity({});
  return { expired: expired.count };
}

export type { DraftInput as OpportunityDraftInput };
