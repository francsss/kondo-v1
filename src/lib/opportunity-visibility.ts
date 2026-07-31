import type {
  OpportunityApplicationStatus,
  OpportunityLifecycleStatus,
  OpportunityPublisherType,
  OrganizationLifecycleStatus,
  Prisma,
} from "@prisma/client";
import {
  isActiveSearchLifecycle,
  isIndexableLifecycle,
  isPubliclyExposableLifecycle,
} from "@/lib/opportunity-lifecycle";
import { opportunityCapabilityFor } from "@/lib/opportunity-types";
import type { OpportunityType } from "@prisma/client";

/**
 * Public visibility policy for opportunities.
 *
 * `publicOpportunityWhere` and `canExposeOpportunityPublicly` express the same
 * rule in the two shapes the codebase needs (a Prisma filter and a predicate on
 * a loaded row). Every public surface — the opportunity route, search, global
 * search, Student Hub, organization projections, metadata, the sitemap and the
 * saved list — goes through one of them.
 *
 * Public visibility is deliberately NOT reused as application authorization:
 * see canUserApplyToOpportunity, canUserViewApplication and
 * canOrganizationReviewApplication below.
 */

type Scope = "ACTIVE" | "HISTORICAL";

export function publicOpportunityWhere(
  options: { now?: Date; scope?: Scope } = {},
): Prisma.OpportunityWhereInput {
  const now = options.now ?? new Date();
  const scope = options.scope ?? "ACTIVE";

  return {
    lifecycle:
      scope === "ACTIVE" ? "PUBLISHED" : { in: ["PUBLISHED", "CLOSED"] },
    publicationBlockedAt: null,
    ...(scope === "ACTIVE"
      ? { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      : {}),
    AND: [
      {
        OR: [
          // Editorial records are owned by Kondo and carry no organization.
          { publisherType: "EDITORIAL" },
          {
            publisherType: "LEGACY_SCHOLARSHIP_AGENT",
            scholarshipAgent: { isActive: true },
          },
          {
            publisherType: "ORGANIZATION",
            publisherOrganization: {
              lifecycleStatus: "ACTIVE",
              publicProfileBlockedAt: null,
            },
          },
        ],
      },
    ],
  };
}

export function canExposeOpportunityPublicly(input: {
  lifecycle: OpportunityLifecycleStatus | string;
  publisherType: OpportunityPublisherType | string;
  publicationBlockedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  organizationLifecycleStatus?: OrganizationLifecycleStatus | string | null;
  organizationPublicProfileBlockedAt?: Date | string | null;
  legacyAgentActive?: boolean | null;
  now?: Date;
  scope?: Scope;
}) {
  const now = input.now ?? new Date();
  const scope = input.scope ?? "ACTIVE";

  const lifecycleOk =
    scope === "ACTIVE"
      ? isActiveSearchLifecycle(input.lifecycle as OpportunityLifecycleStatus)
      : isPubliclyExposableLifecycle(
          input.lifecycle as OpportunityLifecycleStatus,
        );
  if (!lifecycleOk) return false;
  if (input.publicationBlockedAt) return false;
  if (
    scope === "ACTIVE" &&
    input.expiresAt &&
    new Date(input.expiresAt) <= now
  ) {
    return false;
  }

  if (input.publisherType === "EDITORIAL") return true;
  if (input.publisherType === "LEGACY_SCHOLARSHIP_AGENT") {
    return input.legacyAgentActive === true;
  }
  return (
    input.publisherType === "ORGANIZATION" &&
    input.organizationLifecycleStatus === "ACTIVE" &&
    !input.organizationPublicProfileBlockedAt
  );
}

/**
 * Search-engine indexing is stricter than public exposure: a CLOSED
 * opportunity keeps a reachable historical page but is never indexed, and a
 * type may opt out through the registry.
 */
export function canIndexOpportunity(input: {
  lifecycle: OpportunityLifecycleStatus;
  type: OpportunityType;
  publicationBlockedAt?: Date | string | null;
}) {
  if (input.publicationBlockedAt) return false;
  return isIndexableLifecycle(input.lifecycle);
}

/**
 * The organization capability gate. A capability says the organization operates
 * in an area; it never by itself grants a member permission to act.
 */
export function organizationCapabilityAllowsOpportunity(input: {
  type: OpportunityType;
  enabledCapabilities: readonly string[];
}) {
  return input.enabledCapabilities.includes(
    opportunityCapabilityFor(input.type),
  );
}

export function canUserApplyToOpportunity(input: {
  authenticated: boolean;
  applicantStatus?: string | null;
  acceptsKondoApplications: boolean;
  publiclyVisible: boolean;
  hasExistingApplication: boolean;
}) {
  return (
    input.authenticated &&
    input.applicantStatus === "ACTIVE" &&
    input.publiclyVisible &&
    input.acceptsKondoApplications &&
    !input.hasExistingApplication
  );
}

/** The applicant may always read their own application, in any state. */
export function canUserViewApplication(input: {
  viewerUserId: string;
  applicantUserId: string;
}) {
  return input.viewerUserId === input.applicantUserId;
}

/**
 * Reviewer authorization. Requires an active membership in the organization the
 * application was submitted to plus the explicit application permission — a
 * platform admin role never substitutes for organization membership.
 */
export function canOrganizationReviewApplication(input: {
  applicationOrganizationId: string | null | undefined;
  membershipOrganizationId: string | null | undefined;
  membershipStatus: string | null | undefined;
  hasApplicationPermission: boolean;
}) {
  return (
    Boolean(input.applicationOrganizationId) &&
    input.applicationOrganizationId === input.membershipOrganizationId &&
    input.membershipStatus === "ACTIVE" &&
    input.hasApplicationPermission
  );
}

/** Legacy Scholarship rows keep their own, simpler exposure rule. */
export function canExposeLegacyScholarship(input: {
  isActive: boolean;
  status: string;
}) {
  return input.isActive && input.status !== "CLOSED";
}

/**
 * Recommendations are opt-in and never surface an opportunity the user has
 * already applied to or that is no longer public.
 */
export function canRecommendOpportunityToUser(input: {
  publiclyVisible: boolean;
  recommendationsEnabled: boolean;
  alreadyApplied: boolean;
  alreadySaved: boolean;
}) {
  return (
    input.publiclyVisible &&
    input.recommendationsEnabled &&
    !input.alreadyApplied &&
    !input.alreadySaved
  );
}

/** Application states that still count as occupying the one-per-user slot. */
export const ACTIVE_APPLICATION_STATUSES: readonly OpportunityApplicationStatus[] =
  [
    "DRAFT",
    "SUBMITTED",
    "UNDER_REVIEW",
    "MORE_INFORMATION_REQUIRED",
    "SHORTLISTED",
    "INTERVIEW",
    "OFFERED",
    "ACCEPTED",
  ];
