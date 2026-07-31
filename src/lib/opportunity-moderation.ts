import { Prisma, type ReportReason } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog, writeAuditLogWithClient } from "@/lib/audit";
import { OpportunityError } from "@/lib/opportunities";
import { revalidateOpportunity } from "@/lib/opportunity-cache";
import {
  assertOpportunityTransition,
  type OpportunityLifecycleActor,
} from "@/lib/opportunity-lifecycle";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { notifyOpportunityPublisherWithClient } from "@/lib/opportunity-notifications";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

/**
 * Opportunity reporting and platform moderation.
 *
 * Reporting reuses the existing Report model and moderation queue: no second
 * reporting system is introduced. Reporter identity is never returned to the
 * publisher, and a single report never removes an opportunity on its own — a
 * report only opens a case.
 *
 * Removing an opportunity hides it everywhere but never deletes submitted
 * applications: applicants keep their history and see a safe unavailable state.
 */

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export const OPPORTUNITY_REPORT_TARGET_TYPE = "Opportunity";

export async function createOrReuseOpportunityReport(input: {
  actorId: string;
  opportunityId: string;
  reason: ReportReason;
  details?: string | null;
  meta?: RequestMeta;
}) {
  const result = await prisma.$transaction(async (tx) => {
    // A repeat report from the same person reuses the open case instead of
    // creating duplicate noise in the queue.
    const existing = await tx.report.findFirst({
      where: {
        reporterId: input.actorId,
        targetType: OPPORTUNITY_REPORT_TARGET_TYPE,
        targetId: input.opportunityId,
        status: { in: ["OPEN", "REVIEWING"] },
      },
      select: { id: true },
    });
    if (existing) return { reportId: existing.id, reused: true };

    const opportunity = await tx.opportunity.findFirst({
      where: {
        id: input.opportunityId,
        ...publicOpportunityWhere({ scope: "HISTORICAL" }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        type: true,
        lifecycle: true,
        applicationMethod: true,
        externalApplicationUrl: true,
        officialSourceUrl: true,
        publisherType: true,
        publisherOrganizationId: true,
        createdByUserId: true,
        createdAt: true,
      },
    });
    if (!opportunity) {
      throw new OpportunityError("Opportunity not found.", 404);
    }

    const report = await tx.report.create({
      data: {
        reporterId: input.actorId,
        targetType: OPPORTUNITY_REPORT_TARGET_TYPE,
        targetId: opportunity.id,
        subjectUserId: opportunity.createdByUserId,
        reason: input.reason,
        details: input.details?.trim().slice(0, 1000) || null,
      },
      select: { id: true },
    });

    // Metadata-only evidence snapshot: no applicant data and no private
    // organization fields are captured.
    await tx.reportEvidence.create({
      data: {
        reportId: report.id,
        kind: "OPPORTUNITY_SNAPSHOT",
        label: `Opportunity ${opportunity.slug}`,
        snapshot: {
          id: opportunity.id,
          slug: opportunity.slug,
          title: opportunity.title,
          summary: opportunity.shortDescription,
          type: opportunity.type,
          lifecycle: opportunity.lifecycle,
          applicationMethod: opportunity.applicationMethod,
          externalApplicationUrl: opportunity.externalApplicationUrl,
          officialSourceUrl: opportunity.officialSourceUrl,
          publisherType: opportunity.publisherType,
          publisherOrganizationId: opportunity.publisherOrganizationId,
          createdAt: opportunity.createdAt.toISOString(),
        } satisfies Prisma.InputJsonObject,
        capturedById: input.actorId,
      },
    });

    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "OPPORTUNITY_REPORT_CREATED",
      entityType: OPPORTUNITY_REPORT_TARGET_TYPE,
      entityId: opportunity.id,
      ipAddress: input.meta?.ipAddress ?? null,
      userAgent: input.meta?.userAgent ?? null,
    });

    return { reportId: report.id, reused: false, type: opportunity.type };
  });

  if (!result.reused) {
    await Promise.all([
      trackEvent({
        name: "OPPORTUNITY_REPORT_SUBMITTED",
        userId: input.actorId,
        properties: { reason: input.reason },
      }),
      captureServerProductEvent({
        distinctId: input.actorId,
        event: PRODUCT_EVENTS.OPPORTUNITY_REPORT_SUBMITTED,
        properties: { reason: input.reason },
      }),
    ]);
  }
  return result;
}

/**
 * Platform moderation action. Lifecycle transitions go through the shared
 * moderator table, and the publisher-visible note is stored separately from the
 * internal note so the two can never be conflated.
 */
export async function moderateOpportunity(input: {
  adminUserId: string;
  opportunityId: string;
  action:
    | "APPROVE"
    | "REJECT"
    | "PAUSE"
    | "REMOVE"
    | "RESTORE"
    | "BLOCK_EXTERNAL_SOURCE";
  publisherVisibleNote?: string | null;
  internalNote?: string | null;
}) {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: input.opportunityId },
    select: {
      id: true,
      slug: true,
      title: true,
      lifecycle: true,
      publisherOrganizationId: true,
      publisherOrganization: { select: { slug: true } },
      city: { select: { slug: true } },
    },
  });
  if (!opportunity) throw new OpportunityError("Opportunity not found.", 404);

  const actor: OpportunityLifecycleActor = "MODERATOR";
  const now = new Date();
  const data: Prisma.OpportunityUpdateInput = {
    moderationNote: input.internalNote?.trim() || undefined,
    publisherVisibleNote: input.publisherVisibleNote?.trim() || undefined,
  };

  if (input.action === "BLOCK_EXTERNAL_SOURCE") {
    // Suppresses the outbound action without changing the lifecycle.
    data.externalUrlBlockedAt = now;
  } else {
    const target =
      input.action === "APPROVE"
        ? "PUBLISHED"
        : input.action === "REJECT"
          ? "REJECTED"
          : input.action === "PAUSE"
            ? "PAUSED"
            : input.action === "REMOVE"
              ? "REMOVED"
              : "PENDING_REVIEW";
    assertOpportunityTransition({
      actor,
      from: opportunity.lifecycle,
      to: target,
    });
    data.lifecycle = target;
    if (target === "PUBLISHED") {
      data.publishedAt = now;
      data.publicationBlockedAt = null;
    }
    if (target === "REMOVED" || target === "REJECTED" || target === "PAUSED") {
      data.publicationBlockedAt = now;
      data.publicationBlockedBy = { connect: { id: input.adminUserId } };
    }
    if (target === "PENDING_REVIEW") {
      data.publicationBlockedAt = null;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.opportunity.update({
      where: { id: opportunity.id },
      data,
    });
    if (
      opportunity.publisherOrganizationId &&
      opportunity.publisherOrganization
    ) {
      await notifyOpportunityPublisherWithClient(tx, {
        organizationId: opportunity.publisherOrganizationId,
        organizationSlug: opportunity.publisherOrganization.slug,
        opportunityId: opportunity.id,
        opportunityTitle: opportunity.title,
        actorId: input.adminUserId,
        templateKey: "OPPORTUNITY_MODERATION_RESULT",
        outcome: input.action.toLowerCase().replaceAll("_", " "),
        dedupeKey: `opportunity-moderation:${opportunity.id}:${input.action}:${now.toISOString()}`,
      });
    }
  });

  await writeAuditLog({
    actorId: input.adminUserId,
    action: `OPPORTUNITY_MODERATION_${input.action}`,
    entityType: "Opportunity",
    entityId: opportunity.id,
    oldValue: { lifecycle: opportunity.lifecycle },
    newValue: { lifecycle: data.lifecycle ?? opportunity.lifecycle },
  });

  // Invalidates the public page, search, Student Hub and the organization
  // projection in one call.
  revalidateOpportunity({
    opportunityId: opportunity.id,
    slug: opportunity.slug,
    organizationSlug: opportunity.publisherOrganization?.slug ?? null,
    citySlug: opportunity.city?.slug ?? null,
  });

  return { lifecycle: data.lifecycle ?? opportunity.lifecycle };
}
