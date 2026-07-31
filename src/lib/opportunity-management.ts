import type { z } from "zod";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import type {
  opportunityDraftSchema,
  jobDetailSchema,
  scholarshipDetailSchema,
} from "@/features/opportunities/schemas";
import { OpportunityError } from "@/lib/opportunities";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
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

export async function createOrganizationOpportunity(input: {
  userId: string;
  organizationId: string;
  draft: DraftInput;
  scholarship?: ScholarshipInput | null;
  job?: JobInput | null;
}) {
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

export async function updateOrganizationOpportunity(input: {
  userId: string;
  organizationId: string;
  opportunityId: string;
  draft: DraftInput;
  scholarship?: ScholarshipInput | null;
  job?: JobInput | null;
}) {
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

  await prisma.$transaction(async (tx) => {
    await tx.opportunityDegreeLevel.deleteMany({
      where: { opportunityId: existing.id },
    });
    await tx.opportunityFieldOfStudy.deleteMany({
      where: { opportunityId: existing.id },
    });
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
      },
    });

    if (definition.detail === "scholarship" && input.scholarship) {
      await tx.opportunityScholarshipDetail.upsert({
        where: { opportunityId: existing.id },
        create: { opportunityId: existing.id, ...input.scholarship },
        update: input.scholarship,
      });
    }
    if (definition.detail === "job" && input.job) {
      await tx.opportunityJobDetail.upsert({
        where: { opportunityId: existing.id },
        create: { opportunityId: existing.id, ...input.job },
        update: input.job,
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
  await prisma.opportunity.update({
    where: { id: existing.id },
    data: {
      lifecycle: target,
      submittedAt: target === "PENDING_REVIEW" ? now : undefined,
      publishedAt: target === "PUBLISHED" ? now : undefined,
      closedAt: target === "CLOSED" ? now : undefined,
      archivedAt: target === "ARCHIVED" ? now : undefined,
    },
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
