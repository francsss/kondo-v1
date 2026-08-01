import type { OrganizationCapabilityKey } from "@prisma/client";
import type { OrganizationPermission } from "@/lib/organization-authorization";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { organizationAllowsPublishing } from "@/lib/organization-lifecycle";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { prisma } from "@/lib/prisma";

export type CatalogKind = "product" | "service";

const configuration = {
  product: {
    capability: "PRODUCTS" as const,
    create: "ORGANIZATION_CREATE_PRODUCTS" as const,
    edit: "ORGANIZATION_EDIT_PRODUCTS" as const,
    publish: "ORGANIZATION_PUBLISH_PRODUCTS" as const,
    archive: "ORGANIZATION_ARCHIVE_PRODUCTS" as const,
  },
  service: {
    capability: "STUDENT_SERVICES" as const,
    create: "ORGANIZATION_CREATE_SERVICES" as const,
    edit: "ORGANIZATION_EDIT_SERVICES" as const,
    publish: "ORGANIZATION_PUBLISH_SERVICES" as const,
    archive: "ORGANIZATION_ARCHIVE_SERVICES" as const,
  },
} satisfies Record<
  CatalogKind,
  Record<"capability", OrganizationCapabilityKey> &
    Record<"create" | "edit" | "publish" | "archive", OrganizationPermission>
>;

export function catalogCapability(kind: CatalogKind) {
  return configuration[kind].capability;
}

export function catalogPermission(
  kind: CatalogKind,
  action: "create" | "edit" | "publish" | "archive",
) {
  return configuration[kind][action];
}

/** Capability and member permission are evaluated independently, every time. */
export async function requireCatalogPublisher(input: {
  userId: string;
  organizationId: string;
  kind: CatalogKind;
  action: "create" | "edit" | "publish" | "archive";
  requiresPublishing?: boolean;
}) {
  const [organization, membership] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: {
        id: true,
        slug: true,
        lifecycleStatus: true,
        publicProfileStatus: true,
        capabilities: {
          where: { key: catalogCapability(input.kind) },
          select: { key: true, status: true },
        },
      },
    }),
    prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId,
        },
      },
      select: { role: true, status: true },
    }),
  ]);
  if (!organization)
    throw new OrganizationAccessError("Organization not found.", 404);
  if (!membership || membership.status !== "ACTIVE") {
    throw new OrganizationAccessError(
      "You do not have access to this organization.",
      403,
    );
  }
  if (
    !hasOrganizationPermission(
      membership,
      catalogPermission(input.kind, input.action),
    )
  ) {
    throw new OrganizationAccessError(
      `You do not have permission to ${input.action} organization ${input.kind}s.`,
      403,
    );
  }
  if (organization.capabilities[0]?.status !== "ENABLED") {
    throw new OrganizationAccessError(
      `Enable the ${catalogCapability(input.kind)} capability before managing ${input.kind}s.`,
      403,
    );
  }
  if (
    input.requiresPublishing &&
    !organizationAllowsPublishing(organization.lifecycleStatus)
  ) {
    throw new OrganizationAccessError(
      "This organization cannot publish while inactive or suspended.",
      403,
    );
  }
  return { organization, membership };
}
