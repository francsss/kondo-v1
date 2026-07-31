import type { HousingListingType } from "@prisma/client";
import { PERSONAL_HOUSING_LISTING_TYPES } from "@/features/housing/registry";
import {
  hasOrganizationPermission,
  type OrganizationPermission,
} from "@/lib/organization-authorization";
import { prisma } from "@/lib/prisma";

export class HousingAccessError extends Error {
  constructor(
    message: string,
    public status = 403,
  ) {
    super(message);
    this.name = "HousingAccessError";
  }
}

export function canPublishPersonalHousingType(type: HousingListingType) {
  return PERSONAL_HOUSING_LISTING_TYPES.includes(
    type as (typeof PERSONAL_HOUSING_LISTING_TYPES)[number],
  );
}

export async function requireOrganizationHousingPermission(input: {
  userId: string;
  organizationId: string;
  permission: Extract<
    OrganizationPermission,
    | "ORGANIZATION_MANAGE_HOUSING"
    | "ORGANIZATION_CREATE_HOUSING"
    | "ORGANIZATION_EDIT_HOUSING"
    | "ORGANIZATION_PUBLISH_HOUSING"
    | "ORGANIZATION_VIEW_HOUSING_INQUIRIES"
    | "ORGANIZATION_MODERATE_HOUSING_TEAM"
  >;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      slug: true,
      publicName: true,
      lifecycleStatus: true,
      verificationStatus: true,
      publicProfileStatus: true,
      memberships: {
        where: { userId: input.userId },
        select: { role: true, status: true },
        take: 1,
      },
      capabilities: {
        where: { key: "HOUSING" },
        select: { status: true },
        take: 1,
      },
    },
  });
  const membership = organization?.memberships[0];
  if (!organization || !membership || membership.status !== "ACTIVE") {
    throw new HousingAccessError(
      "You do not have access to this organization Housing workspace.",
    );
  }
  if (organization.lifecycleStatus !== "ACTIVE") {
    throw new HousingAccessError("This organization cannot publish Housing.");
  }
  if (organization.capabilities[0]?.status !== "ENABLED") {
    throw new HousingAccessError(
      "Housing is not enabled for this organization.",
    );
  }
  if (!hasOrganizationPermission(membership, input.permission)) {
    throw new HousingAccessError(
      "You do not have permission to perform this Housing action.",
    );
  }
  return { organization, membership };
}

export async function assertHousingListingOwner(input: {
  userId: string;
  listingId: string;
  permission?: "EDIT" | "PUBLISH" | "INQUIRIES";
}) {
  const listing = await prisma.housingListing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      publisherType: true,
      publisherUserId: true,
      publisherOrganizationId: true,
      status: true,
    },
  });
  if (!listing) throw new HousingAccessError("Housing listing not found.", 404);
  if (listing.publisherType === "PERSONAL") {
    if (listing.publisherUserId !== input.userId) {
      throw new HousingAccessError("Housing listing not found.", 404);
    }
    return listing;
  }
  await requireOrganizationHousingPermission({
    userId: input.userId,
    organizationId: listing.publisherOrganizationId!,
    permission:
      input.permission === "PUBLISH"
        ? "ORGANIZATION_PUBLISH_HOUSING"
        : input.permission === "INQUIRIES"
          ? "ORGANIZATION_VIEW_HOUSING_INQUIRIES"
          : "ORGANIZATION_EDIT_HOUSING",
  });
  return listing;
}
