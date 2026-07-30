import type { Prisma } from "@prisma/client";
import {
  hasOrganizationPermission,
  type OrganizationPermission,
} from "@/lib/organization-authorization";
import { prisma } from "@/lib/prisma";

type OrganizationLookup = { id?: string; slug?: string };
type MembershipClient = Pick<
  Prisma.TransactionClient,
  "organization" | "organizationMembership"
>;

export class OrganizationAccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
    this.name = "OrganizationAccessError";
  }
}

function lookupWhere(lookup: OrganizationLookup) {
  if (lookup.id) return { id: lookup.id };
  if (lookup.slug) return { slug: lookup.slug };
  throw new OrganizationAccessError("Organization not found.", 404);
}

export async function getOrganizationMembership(
  userId: string,
  lookup: OrganizationLookup,
  client: MembershipClient = prisma,
) {
  const organization = await client.organization.findUnique({
    where: lookupWhere(lookup),
    select: { id: true },
  });
  if (!organization) return null;
  return client.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId,
      },
    },
    select: {
      organizationId: true,
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
    },
  });
}

export async function requireOrganizationMembership(
  userId: string,
  lookup: OrganizationLookup,
  client: MembershipClient = prisma,
) {
  const membership = await getOrganizationMembership(userId, lookup, client);
  if (!membership || membership.status !== "ACTIVE") {
    throw new OrganizationAccessError(
      "You do not have access to this organization workspace.",
      403,
    );
  }
  return membership;
}

export async function requireOrganizationPermission(
  userId: string,
  lookup: OrganizationLookup,
  permission: OrganizationPermission,
  client: MembershipClient = prisma,
) {
  const membership = await requireOrganizationMembership(
    userId,
    lookup,
    client,
  );
  if (!hasOrganizationPermission(membership, permission)) {
    throw new OrganizationAccessError(
      "You do not have permission to perform this organization action.",
      403,
    );
  }
  return membership;
}
