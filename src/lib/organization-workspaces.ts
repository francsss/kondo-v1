import { Prisma } from "@prisma/client";
import { visibleOrganizationRole } from "@/lib/organization-authorization";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { organizationProfileCompleteness } from "@/lib/organization-profile";
import { prisma } from "@/lib/prisma";

const workspaceOrganizationSelect = {
  id: true,
  slug: true,
  publicName: true,
  legalName: true,
  type: true,
  tagline: true,
  shortDescription: true,
  extendedDescription: true,
  foundingYear: true,
  sizeRange: true,
  countryId: true,
  cityId: true,
  website: true,
  professionalEmail: true,
  professionalPhone: true,
  websiteWechat: true,
  publicAddress: true,
  serviceAreas: true,
  supportedLanguages: true,
  contactAudience: true,
  logoMediaId: true,
  coverMediaId: true,
  lifecycleStatus: true,
  publicProfileStatus: true,
  verificationStatus: true,
  isOfficialPartner: true,
  setupCompletedAt: true,
  suspendedAt: true,
  suspensionReason: true,
  archivedAt: true,
  country: { select: { id: true, code: true, name: true, emoji: true } },
  city: { select: { id: true, name: true, province: true } },
  capabilities: {
    orderBy: { createdAt: "asc" as const },
    select: { key: true, status: true },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationSelect;

function iso(value?: Date | null) {
  return value?.toISOString() ?? null;
}

function workspaceOrganizationDto<
  T extends Prisma.OrganizationGetPayload<{
    select: typeof workspaceOrganizationSelect;
  }>,
>(organization: T) {
  return {
    ...organization,
    setupCompletedAt: iso(organization.setupCompletedAt),
    suspendedAt: iso(organization.suspendedAt),
    archivedAt: iso(organization.archivedAt),
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
  };
}

export async function listOrganizationWorkspaces(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { lifecycleStatus: { not: "ARCHIVED" } },
    },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          slug: true,
          publicName: true,
          type: true,
          logoMediaId: true,
          lifecycleStatus: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  return memberships.map(({ role, organization }) => ({
    ...organization,
    role: visibleOrganizationRole(role),
  }));
}

export async function getOrganizationWorkspace(userId: string, slug: string) {
  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: {
      ...workspaceOrganizationSelect,
      memberships: {
        where: { userId },
        select: { role: true, status: true, joinedAt: true },
        take: 1,
      },
      _count: {
        select: {
          memberships: { where: { status: "ACTIVE" } },
          invitations: { where: { status: "PENDING" } },
        },
      },
    },
  });
  if (!organization) {
    const alias = await prisma.organizationSlugAlias.findUnique({
      where: { slug },
      select: { organization: { select: { slug: true } } },
    });
    if (alias) {
      throw new OrganizationAccessError(
        `ORGANIZATION_MOVED:${alias.organization.slug}`,
        308,
      );
    }
    throw new OrganizationAccessError("Organization not found.", 404);
  }
  const membership = organization.memberships[0];
  if (!membership || membership.status !== "ACTIVE") {
    throw new OrganizationAccessError(
      "You do not have access to this organization workspace.",
      403,
    );
  }
  if (organization.lifecycleStatus === "ARCHIVED") {
    throw new OrganizationAccessError(
      "This organization has been archived.",
      410,
    );
  }
  const { _count, ...record } = organization;
  const dto = workspaceOrganizationDto(record);
  return {
    organization: dto,
    membership: {
      role: visibleOrganizationRole(membership.role),
      storedRole: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt.toISOString(),
    },
    counts: {
      activeMembers: _count.memberships,
      pendingInvitations: _count.invitations,
    },
    completeness: organizationProfileCompleteness({
      ...dto,
      capabilities: dto.capabilities.filter(
        (capability) => capability.status === "ENABLED",
      ),
    }),
  };
}

export async function listOrganizationActivity(
  userId: string,
  slug: string,
  page = 1,
) {
  const workspace = await getOrganizationWorkspace(userId, slug);
  const currentPage = Math.max(1, Math.floor(page));
  const pageSize = 30;
  const where = { organizationId: workspace.organization.id };
  const [total, events] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarMediaId: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    workspace,
    events: events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
    page: currentPage,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}
