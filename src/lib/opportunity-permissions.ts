import type { OpportunityType, Prisma } from "@prisma/client";
import {
  hasOrganizationPermission,
  type OrganizationPermission,
} from "@/lib/organization-authorization";
import { organizationAllowsPublishing } from "@/lib/organization-lifecycle";
import { opportunityCapabilityFor } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";

/**
 * Publisher authorization for opportunities.
 *
 * Three conditions must hold independently, and none implies another:
 *   1. the organization operates in the area  (capability ENABLED)
 *   2. the organization is allowed to publish (lifecycle)
 *   3. the acting member may take the action  (permission)
 *
 * Enabling a capability therefore never grants a member the right to publish,
 * and a platform admin role never substitutes for organization membership.
 */

export class OpportunityAccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
    this.name = "OpportunityAccessError";
  }
}

type MembershipContext = {
  organizationId: string;
  role: Prisma.OrganizationMembershipGetPayload<object>["role"];
  status: Prisma.OrganizationMembershipGetPayload<object>["status"];
};

export async function loadOpportunityPublisherContext(input: {
  userId: string;
  organizationId: string;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const client = input.client ?? prisma;
  const [organization, membership] = await Promise.all([
    client.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        id: true,
        slug: true,
        publicName: true,
        lifecycleStatus: true,
        publicProfileStatus: true,
        publicProfileBlockedAt: true,
        capabilities: {
          where: { status: "ENABLED" },
          select: { key: true },
        },
      },
    }),
    client.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      select: { organizationId: true, role: true, status: true },
    }),
  ]);

  if (!organization) {
    throw new OpportunityAccessError("Organization not found.", 404);
  }
  if (!membership || membership.status !== "ACTIVE") {
    // A removed member loses workspace access immediately.
    throw new OpportunityAccessError(
      "You do not have access to this organization workspace.",
      403,
    );
  }

  return {
    organization,
    membership: membership as MembershipContext,
    enabledCapabilities: organization.capabilities.map(({ key }) => key),
  };
}

export function assertOpportunityCapability(input: {
  type: OpportunityType;
  enabledCapabilities: readonly string[];
}) {
  const required = opportunityCapabilityFor(input.type);
  if (!input.enabledCapabilities.includes(required)) {
    throw new OpportunityAccessError(
      "This organization has not enabled the activity area for this opportunity type.",
      403,
    );
  }
}

export function assertOpportunityPermission(input: {
  membership: {
    role: MembershipContext["role"];
    status: MembershipContext["status"];
  };
  permission: OrganizationPermission;
}) {
  if (!hasOrganizationPermission(input.membership, input.permission)) {
    throw new OpportunityAccessError(
      "You do not have permission to perform this opportunity action.",
      403,
    );
  }
}

export function assertOrganizationMayPublish(lifecycleStatus: string) {
  if (
    !organizationAllowsPublishing(
      lifecycleStatus as Parameters<typeof organizationAllowsPublishing>[0],
    )
  ) {
    throw new OpportunityAccessError(
      "This organization cannot publish while its account is not active.",
      403,
    );
  }
}

/**
 * Full publisher gate for a mutating opportunity action. Callers pass the
 * permission the specific action needs; publishing additionally re-checks the
 * organization lifecycle so a suspension takes effect immediately.
 */
export async function requireOpportunityPublisher(input: {
  userId: string;
  organizationId: string;
  type: OpportunityType;
  permission: OrganizationPermission;
  requiresPublishing?: boolean;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const context = await loadOpportunityPublisherContext(input);
  assertOpportunityCapability({
    type: input.type,
    enabledCapabilities: context.enabledCapabilities,
  });
  assertOpportunityPermission({
    membership: context.membership,
    permission: input.permission,
  });
  if (input.requiresPublishing) {
    assertOrganizationMayPublish(context.organization.lifecycleStatus);
  }
  return context;
}

/**
 * Application-review gate. Deliberately separate from the publishing gate:
 * reading applicant answers and documents requires its own permission, which
 * EDITOR does not hold by default.
 */
export async function requireApplicationReviewer(input: {
  userId: string;
  organizationId: string;
  permission?: OrganizationPermission;
  client?: Prisma.TransactionClient | typeof prisma;
}) {
  const client = input.client ?? prisma;
  const membership = await client.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: input.organizationId,
        userId: input.userId,
      },
    },
    select: { organizationId: true, role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") {
    throw new OpportunityAccessError(
      "You do not have access to this organization workspace.",
      403,
    );
  }
  assertOpportunityPermission({
    membership,
    permission: input.permission ?? "ORGANIZATION_VIEW_APPLICATIONS",
  });
  return membership;
}
