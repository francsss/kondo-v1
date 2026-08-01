import type { Prisma } from "@prisma/client";

/**
 * The only public exposure policy for organization catalog records.
 * Every public page, search provider, City Hub and Essentials projection uses
 * these predicates so a suspension or moderation block disappears everywhere.
 */
export const publicOrganizationProductWhere = {
  status: "PUBLISHED",
  publicationBlockedAt: null,
  organization: {
    lifecycleStatus: "ACTIVE",
    publicProfileStatus: "PUBLISHED",
    publicProfileBlockedAt: null,
    capabilities: { some: { key: "PRODUCTS", status: "ENABLED" } },
  },
} satisfies Prisma.OrganizationProductWhereInput;

export const publicOrganizationServiceWhere = {
  status: "PUBLISHED",
  publicationBlockedAt: null,
  organization: {
    lifecycleStatus: "ACTIVE",
    publicProfileStatus: "PUBLISHED",
    publicProfileBlockedAt: null,
    capabilities: { some: { key: "STUDENT_SERVICES", status: "ENABLED" } },
  },
} satisfies Prisma.OrganizationServiceWhereInput;

export function canExposeCatalogResource(input: {
  status: string;
  publicationBlockedAt?: Date | string | null;
  organizationLifecycle: string;
  organizationPublicProfileStatus: string;
  organizationPublicProfileBlockedAt?: Date | string | null;
  capabilityEnabled: boolean;
}) {
  return (
    input.status === "PUBLISHED" &&
    !input.publicationBlockedAt &&
    input.organizationLifecycle === "ACTIVE" &&
    input.organizationPublicProfileStatus === "PUBLISHED" &&
    !input.organizationPublicProfileBlockedAt &&
    input.capabilityEnabled
  );
}
