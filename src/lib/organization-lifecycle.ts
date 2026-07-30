import type { OrganizationLifecycleStatus } from "@prisma/client";

const TRANSITIONS: Record<
  OrganizationLifecycleStatus,
  readonly OrganizationLifecycleStatus[]
> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionOrganizationLifecycle(
  current: OrganizationLifecycleStatus,
  next: OrganizationLifecycleStatus,
) {
  return TRANSITIONS[current].includes(next);
}

export function assertOrganizationLifecycleTransition(
  current: OrganizationLifecycleStatus,
  next: OrganizationLifecycleStatus,
) {
  if (!canTransitionOrganizationLifecycle(current, next)) {
    throw new Error(`Organization cannot move from ${current} to ${next}.`);
  }
}

export function organizationAllowsWorkspace(
  status: OrganizationLifecycleStatus,
) {
  return status !== "ARCHIVED";
}

export function organizationAllowsMutation(
  status: OrganizationLifecycleStatus,
) {
  return status === "DRAFT" || status === "ACTIVE";
}

export function organizationAllowsPublishing(
  status: OrganizationLifecycleStatus,
) {
  return status === "ACTIVE";
}

export function organizationIsPubliclyEligible(
  status: OrganizationLifecycleStatus,
) {
  return status === "ACTIVE";
}
