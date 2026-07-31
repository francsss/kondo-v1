import type {
  OrganizationCapabilityKey,
  OrganizationCapabilityStatus,
  OrganizationLifecycleStatus,
} from "@prisma/client";
import {
  hasOrganizationPermission,
  type OrganizationMembershipContext,
  type OrganizationPermission,
} from "@/lib/organization-authorization";
import { organizationAllowsPublishing } from "@/lib/organization-lifecycle";

/**
 * Organization workspace navigation registry.
 *
 * Part 5 shipped the organization Opportunities routes without ever adding a
 * navigation entry, so the whole publishing surface was reachable only by
 * typing its URL. Navigation is now derived here, once, from the same
 * membership permissions the server routes enforce — the registry decides what
 * is *shown*, never what is *allowed*.
 *
 * Icons are returned as stable keys rather than components so a server
 * component can compute the navigation and pass it to the client shell as
 * plain, serializable data.
 */

export type WorkspaceNavigationIconKey =
  | "dashboard"
  | "profile"
  | "public-profile"
  | "housing"
  | "opportunities"
  | "applications"
  | "team"
  | "verification"
  | "activity"
  | "settings";

export type WorkspaceNavigationItem = {
  key: WorkspaceNavigationIconKey;
  segment: string;
  label: string;
  href: string;
  icon: WorkspaceNavigationIconKey;
  /**
   * `enabled`  — the section works normally.
   * `setup`    — visible, reachable, and explains what is missing. A missing
   *              capability never hides the entry: a silently absent item is
   *              indistinguishable from a bug for the person who must fix it.
   */
  state: "enabled" | "setup";
  /** Shown on the entry and on the section's locked state. */
  setupReason?: string;
  /** Whether the entry belongs to the primary mobile bar. */
  primaryOnMobile: boolean;
};

export type WorkspaceNavigationOrganization = {
  slug: string;
  lifecycleStatus: OrganizationLifecycleStatus | string;
  capabilities?: ReadonlyArray<{
    key: OrganizationCapabilityKey | string;
    status: OrganizationCapabilityStatus | string;
  }>;
};

/** Capabilities that make the Opportunities module meaningful for a publisher. */
export const OPPORTUNITY_CAPABILITY_KEYS = [
  "SCHOLARSHIPS",
  "INTERNSHIPS_JOBS",
] as const satisfies ReadonlyArray<OrganizationCapabilityKey>;

function enabledCapabilityKeys(
  organization: WorkspaceNavigationOrganization,
): string[] {
  return (organization.capabilities ?? [])
    .filter((capability) => capability.status === "ENABLED")
    .map((capability) => capability.key);
}

export function organizationHasOpportunityCapability(
  organization: WorkspaceNavigationOrganization,
) {
  const enabled = enabledCapabilityKeys(organization);
  return OPPORTUNITY_CAPABILITY_KEYS.some((key) => enabled.includes(key));
}

function permitted(
  membership: OrganizationMembershipContext | null | undefined,
  permission: OrganizationPermission,
) {
  return hasOrganizationPermission(membership, permission);
}

/**
 * The workspace navigation for one member of one organization.
 *
 * Every entry a member is permitted to open is returned; entries requiring a
 * permission the member lacks are omitted, which mirrors the server routes
 * that would answer 403 anyway.
 */
export function organizationWorkspaceNavigation(input: {
  organization: WorkspaceNavigationOrganization;
  membership: OrganizationMembershipContext | null | undefined;
}): WorkspaceNavigationItem[] {
  const { organization, membership } = input;
  const slug = organization.slug;
  const href = (segment: string) => `/organizations/${slug}/${segment}`;
  const enabled = enabledCapabilityKeys(organization);
  const items: WorkspaceNavigationItem[] = [];

  const push = (item: Omit<WorkspaceNavigationItem, "href">) =>
    items.push({ ...item, href: href(item.segment) });

  push({
    key: "dashboard",
    segment: "dashboard",
    label: "Dashboard",
    icon: "dashboard",
    state: "enabled",
    primaryOnMobile: true,
  });

  if (permitted(membership, "ORGANIZATION_VIEW_DASHBOARD")) {
    push({
      key: "profile",
      segment: "profile",
      label: "Profile",
      icon: "profile",
      state: "enabled",
      primaryOnMobile: false,
    });
    push({
      key: "public-profile",
      segment: "public-profile",
      label: "Public profile",
      icon: "public-profile",
      state: "enabled",
      primaryOnMobile: false,
    });
  }

  if (
    enabled.includes("HOUSING") &&
    permitted(membership, "ORGANIZATION_CREATE_HOUSING")
  ) {
    push({
      key: "housing",
      segment: "housing",
      label: "Housing",
      icon: "housing",
      state: "enabled",
      primaryOnMobile: true,
    });
  }

  // Opportunities sits immediately after Housing and stays visible whenever the
  // member may view it, capability or not.
  if (permitted(membership, "ORGANIZATION_VIEW_OPPORTUNITIES")) {
    const hasCapability = organizationHasOpportunityCapability(organization);
    push({
      key: "opportunities",
      segment: "opportunities",
      label: "Opportunities",
      icon: "opportunities",
      state: hasCapability ? "enabled" : "setup",
      setupReason: hasCapability
        ? undefined
        : "Enable Scholarships or Internships & jobs to publish opportunities.",
      primaryOnMobile: true,
    });
  }

  if (permitted(membership, "ORGANIZATION_VIEW_APPLICATIONS")) {
    push({
      key: "applications",
      segment: "opportunities/applications",
      label: "Applications",
      icon: "applications",
      state: "enabled",
      primaryOnMobile: true,
    });
  }

  if (permitted(membership, "ORGANIZATION_MANAGE_TEAM")) {
    push({
      key: "team",
      segment: "team",
      label: "Team",
      icon: "team",
      state: "enabled",
      primaryOnMobile: false,
    });
  }

  if (permitted(membership, "ORGANIZATION_MANAGE_VERIFICATION")) {
    push({
      key: "verification",
      segment: "verification",
      label: "Verification",
      icon: "verification",
      state: "enabled",
      primaryOnMobile: false,
    });
  }

  if (permitted(membership, "ORGANIZATION_VIEW_ACTIVITY")) {
    push({
      key: "activity",
      segment: "activity",
      label: "Activity",
      icon: "activity",
      state: "enabled",
      primaryOnMobile: false,
    });
  }

  push({
    key: "settings",
    segment: "settings",
    label: "Settings",
    icon: "settings",
    state: "enabled",
    primaryOnMobile: false,
  });

  return items;
}

/**
 * Marks the entry matching the current pathname. A nested route such as
 * `.../opportunities/new` keeps its parent entry active, and the more specific
 * Applications entry wins over the Opportunities prefix it shares.
 */
export function activeWorkspaceNavigationKey(
  items: readonly WorkspaceNavigationItem[],
  pathname: string,
): WorkspaceNavigationIconKey | null {
  const matches = items.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  if (!matches.length) return null;
  return matches.reduce((best, item) =>
    item.href.length > best.href.length ? item : best,
  ).key;
}

export type OpportunitySetupRequirement = {
  key: string;
  label: string;
  met: boolean;
  /** Where the member can go to satisfy the requirement, when one exists. */
  actionHref?: string;
  actionLabel?: string;
};

/**
 * The Opportunities setup checklist.
 *
 * Capability, permission, lifecycle and publication are deliberately reported
 * as separate requirements: enabling a capability never grants a permission,
 * and a complete profile never substitutes for one.
 */
export function opportunitySetupState(input: {
  organization: WorkspaceNavigationOrganization & {
    publicProfileStatus?: string;
    suspensionReason?: string | null;
  };
  membership: OrganizationMembershipContext | null | undefined;
  profileComplete: boolean;
}): {
  requirements: OpportunitySetupRequirement[];
  canCreateDraft: boolean;
  canPublish: boolean;
  blockedReason: string | null;
} {
  const { organization, membership } = input;
  const slug = organization.slug;
  const hasCapability = organizationHasOpportunityCapability(organization);
  const active = organization.lifecycleStatus === "ACTIVE";
  const suspended = organization.lifecycleStatus === "SUSPENDED";
  const mayPublishLifecycle = organizationAllowsPublishing(
    organization.lifecycleStatus as OrganizationLifecycleStatus,
  );
  const canCreate = permitted(membership, "ORGANIZATION_CREATE_OPPORTUNITIES");
  const canPublishPermission = permitted(
    membership,
    "ORGANIZATION_PUBLISH_OPPORTUNITIES",
  );

  const requirements: OpportunitySetupRequirement[] = [
    {
      key: "organization-active",
      label: "Organization is active",
      met: active,
    },
    {
      key: "membership-active",
      label: "Your membership is active",
      met: membership?.status === "ACTIVE",
    },
    {
      key: "capability",
      label: "Scholarships or Internships & jobs is enabled",
      met: hasCapability,
      actionHref: permitted(membership, "ORGANIZATION_MANAGE_CAPABILITIES")
        ? `/organizations/${slug}/settings`
        : undefined,
      actionLabel: "Configure activity areas",
    },
    {
      key: "create-permission",
      label: "You may create opportunities",
      met: canCreate,
    },
    {
      key: "publish-permission",
      label: "You may publish opportunities",
      met: canPublishPermission,
    },
    {
      key: "profile",
      label: "Professional profile is complete",
      met: input.profileComplete,
      actionHref: `/organizations/${slug}/profile`,
      actionLabel: "Complete the profile",
    },
    {
      key: "not-suspended",
      label: "Organization is not suspended",
      met: !suspended,
    },
  ];

  // A draft is safe well before an organization may publish: withholding draft
  // creation only blocks the work that would satisfy the remaining items.
  const canCreateDraft =
    canCreate && membership?.status === "ACTIVE" && hasCapability && !suspended;

  const blockedReason = !hasCapability
    ? "This organization has not enabled Scholarships or Internships & jobs yet."
    : suspended
      ? organization.suspensionReason ||
        "This organization is suspended and cannot publish."
      : !canCreate
        ? "Your membership does not include permission to create opportunities."
        : null;

  return {
    requirements,
    canCreateDraft,
    canPublish: canPublishPermission && mayPublishLifecycle && hasCapability,
    blockedReason,
  };
}
