import {
  Prisma,
  type OrganizationCapabilityKey,
  type OrganizationLifecycleStatus,
  type OrganizationType,
  type OrganizationVerificationStatus,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission } from "@/lib/authorization";
import { assertOrganizationLifecycleTransition } from "@/lib/organization-lifecycle";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type Actor = { id: string; role: string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function listAdminOrganizations(
  actor: Actor,
  input: {
    query?: string;
    type?: OrganizationType;
    lifecycleStatus?: OrganizationLifecycleStatus;
    verificationStatus?: OrganizationVerificationStatus;
    capability?: OrganizationCapabilityKey;
    countryId?: string;
    cityId?: string;
    countryQuery?: string;
    cityQuery?: string;
    page?: number;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATIONS_VIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = 25;
  const where: Prisma.OrganizationWhereInput = {
    type: input.type,
    lifecycleStatus: input.lifecycleStatus,
    verificationStatus: input.verificationStatus,
    countryId: input.countryId,
    cityId: input.cityId,
    ...(input.countryQuery
      ? {
          country: {
            name: { contains: input.countryQuery, mode: "insensitive" },
          },
        }
      : {}),
    ...(input.cityQuery
      ? {
          city: {
            name: { contains: input.cityQuery, mode: "insensitive" },
          },
        }
      : {}),
    ...(input.capability
      ? {
          capabilities: {
            some: { key: input.capability, status: "ENABLED" },
          },
        }
      : {}),
    ...(input.query
      ? {
          OR: [
            {
              publicName: {
                contains: input.query,
                mode: "insensitive",
              },
            },
            {
              legalName: {
                contains: input.query,
                mode: "insensitive",
              },
            },
          ],
        }
      : {}),
  };
  const [total, records] = await prisma.$transaction([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        slug: true,
        publicName: true,
        legalName: true,
        type: true,
        lifecycleStatus: true,
        verificationStatus: true,
        isOfficialPartner: true,
        createdAt: true,
        country: { select: { name: true, code: true } },
        city: { select: { name: true } },
        memberships: {
          where: { role: "OWNER", status: "ACTIVE" },
          select: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          take: 1,
        },
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: records.map((record) => ({
      ...record,
      owner: record.memberships[0]?.user ?? null,
      memberships: undefined,
      createdAt: record.createdAt.toISOString(),
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminOrganization(
  actor: Actor,
  organizationId: string,
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATIONS_VIEW")) {
    throw new OrganizationError("Access denied.", 403);
  }
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      country: { select: { name: true, code: true } },
      city: { select: { name: true, province: true } },
      capabilities: { orderBy: { createdAt: "asc" } },
      memberships: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarMediaId: true,
              status: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      verificationRequests: {
        where: { status: { notIn: ["DRAFT", "WITHDRAWN"] } },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          version: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      auditLogs: {
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          actor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  return organization;
}

export async function updateOrganizationLifecycleAsAdmin(
  actor: Actor,
  organizationId: string,
  input: {
    status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
    reason: string;
  },
  meta: RequestMeta = {},
) {
  const permission =
    input.status === "SUSPENDED" || input.status === "ACTIVE"
      ? "ORGANIZATIONS_SUSPEND"
      : "ORGANIZATIONS_ARCHIVE";
  if (!hasAdminPermission(actor.role, permission)) {
    throw new OrganizationError("Access denied.", 403);
  }
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        publicName: true,
        slug: true,
        lifecycleStatus: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: { userId: true },
        },
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    try {
      assertOrganizationLifecycleTransition(
        current.lifecycleStatus,
        input.status,
      );
    } catch {
      throw new OrganizationError(
        `Organization cannot move from ${current.lifecycleStatus} to ${input.status}.`,
        409,
      );
    }
    const now = new Date();
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        lifecycleStatus: input.status,
        suspendedAt: input.status === "SUSPENDED" ? now : null,
        suspensionReason: input.status === "SUSPENDED" ? input.reason : null,
        archivedAt: input.status === "ARCHIVED" ? now : null,
      },
      select: {
        id: true,
        lifecycleStatus: true,
        suspendedAt: true,
        archivedAt: true,
      },
    });
    for (const membership of current.memberships) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: membership.userId,
        actorId: actor.id,
        type: "MODERATION_UPDATE",
        templateKey: "ORGANIZATION_STATUS_UPDATE",
        data: {
          organizationName: current.publicName,
          outcome: input.reason,
        },
        href:
          input.status === "ARCHIVED"
            ? "/settings/organizations"
            : `/organizations/${current.slug}/dashboard`,
        dedupeKey: `organization-status:${organizationId}:${input.status}:${now.getTime()}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: `ORGANIZATION_${input.status}`,
      entityType: "Organization",
      entityId: organizationId,
      oldValue: { lifecycleStatus: current.lifecycleStatus },
      newValue: {
        lifecycleStatus: updated.lifecycleStatus,
        reason: input.reason,
      },
      ...meta,
    });
    return updated;
  });
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_LIFECYCLE_CHANGED,
    properties: { lifecycle_status: input.status },
  });
  return result;
}

export async function updateOrganizationPartnerStatus(
  actor: Actor,
  organizationId: string,
  isOfficialPartner: boolean,
  reason: string,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "ORGANIZATION_PARTNER_STATUS_MANAGE")) {
    throw new OrganizationError(
      "Only an authorized Super Admin can change partner status.",
      403,
    );
  }
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        isOfficialPartner: true,
        verificationStatus: true,
      },
    });
    if (!current) throw new OrganizationError("Organization not found.", 404);
    if (isOfficialPartner && current.verificationStatus !== "VERIFIED") {
      throw new OrganizationError(
        "Only a verified organization can become an official Kondo partner.",
        409,
      );
    }
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        isOfficialPartner,
        partnerSince: isOfficialPartner ? new Date() : null,
        partnerGrantedById: isOfficialPartner ? actor.id : null,
      },
      select: {
        id: true,
        isOfficialPartner: true,
        partnerSince: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: isOfficialPartner
        ? "ORGANIZATION_PARTNER_GRANTED"
        : "ORGANIZATION_PARTNER_REMOVED",
      entityType: "Organization",
      entityId: organizationId,
      oldValue: { isOfficialPartner: current.isOfficialPartner },
      newValue: { isOfficialPartner, reason },
      ...meta,
    });
    return updated;
  });
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_PARTNER_STATUS_CHANGED,
    properties: { is_official_partner: isOfficialPartner },
  });
  return result;
}
