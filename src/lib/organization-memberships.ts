import type { OrganizationMembershipRole } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  canLeaveOrganization,
  canManageOrganizationMember,
  visibleOrganizationRole,
} from "@/lib/organization-authorization";
import { organizationAllowsMutation } from "@/lib/organization-lifecycle";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";

type Actor = {
  id: string;
  firstName: string;
  lastName: string;
};
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function changeOrganizationMemberRole(
  actor: Actor,
  organizationId: string,
  targetUserId: string,
  role: "ADMIN" | "EDITOR" | "VIEWER",
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const actorMembership = await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_CHANGE_MEMBER_ROLE",
      tx,
    );
    const target = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      select: { role: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") {
      throw new OrganizationError("Active team member not found.", 404);
    }
    if (
      !canManageOrganizationMember({
        actor: actorMembership,
        target,
        nextRole: role,
      })
    ) {
      throw new OrganizationError(
        "You cannot change this team member's role.",
        403,
      );
    }
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        slug: true,
        publicName: true,
        lifecycleStatus: true,
      },
    });
    if (!organizationAllowsMutation(organization.lifecycleStatus)) {
      throw new OrganizationError(
        "Team access cannot be changed in the current organization state.",
        409,
      );
    }
    const updated = await tx.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: { role },
      select: { userId: true, role: true, status: true, updatedAt: true },
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: targetUserId,
      actorId: actor.id,
      type: "ACCOUNT",
      templateKey: "ORGANIZATION_ROLE_CHANGED",
      data: {
        organizationName: organization.publicName,
        role: visibleOrganizationRole(updated.role),
      },
      href: `/organizations/${organization.slug}/dashboard`,
      dedupeKey: `organization-role:${organizationId}:${targetUserId}:${updated.updatedAt.getTime()}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_MEMBER_ROLE_CHANGED",
      entityType: "OrganizationMembership",
      entityId: `${organizationId}:${targetUserId}`,
      oldValue: { role: target.role },
      newValue: { role: updated.role },
      ...meta,
    });
    return {
      ...updated,
      role: visibleOrganizationRole(updated.role),
      updatedAt: updated.updatedAt.toISOString(),
    };
  });
}

export async function removeOrganizationMember(
  actor: Actor,
  organizationId: string,
  targetUserId: string,
  meta: RequestMeta = {},
) {
  if (actor.id === targetUserId) {
    throw new OrganizationError(
      "Use Leave organization to remove your own access.",
    );
  }
  return prisma.$transaction(async (tx) => {
    const actorMembership = await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_REMOVE_MEMBER",
      tx,
    );
    const target = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      select: { role: true, status: true },
    });
    if (!target || target.status !== "ACTIVE") {
      throw new OrganizationError("Active team member not found.", 404);
    }
    if (!canManageOrganizationMember({ actor: actorMembership, target })) {
      throw new OrganizationError("You cannot remove this team member.", 403);
    }
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        slug: true,
        publicName: true,
        lifecycleStatus: true,
      },
    });
    if (!organizationAllowsMutation(organization.lifecycleStatus)) {
      throw new OrganizationError(
        "Team access cannot be changed in the current organization state.",
        409,
      );
    }
    const removedAt = new Date();
    await tx.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: targetUserId },
      },
      data: {
        status: "REMOVED",
        removedAt,
        removedById: actor.id,
      },
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: targetUserId,
      actorId: actor.id,
      type: "ACCOUNT",
      templateKey: "ORGANIZATION_MEMBER_REMOVED",
      data: { organizationName: organization.publicName },
      href: "/settings/organizations",
      dedupeKey: `organization-member-removed:${organizationId}:${targetUserId}:${removedAt.getTime()}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_MEMBER_REMOVED",
      entityType: "OrganizationMembership",
      entityId: `${organizationId}:${targetUserId}`,
      oldValue: { role: target.role, status: target.status },
      newValue: { status: "REMOVED" },
      ...meta,
    });
  });
}

export async function leaveOrganization(
  actorId: string,
  organizationId: string,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId: actorId },
      },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new OrganizationError(
        "You do not have active access to this organization.",
        404,
      );
    }
    if (!canLeaveOrganization(membership)) {
      throw new OrganizationError(
        "The owner must transfer ownership before leaving.",
        409,
      );
    }
    const now = new Date();
    await tx.organizationMembership.update({
      where: {
        organizationId_userId: { organizationId, userId: actorId },
      },
      data: { status: "LEFT", removedAt: now },
    });
    await writeAuditLogWithClient(tx, {
      actorId,
      organizationId,
      action: "ORGANIZATION_MEMBER_LEFT",
      entityType: "OrganizationMembership",
      entityId: `${organizationId}:${actorId}`,
      oldValue: { role: membership.role, status: membership.status },
      newValue: { status: "LEFT" },
      ...meta,
    });
  });
}

export function isAssignableOrganizationRole(
  role: OrganizationMembershipRole,
): role is "ADMIN" | "EDITOR" | "VIEWER" {
  return role === "ADMIN" || role === "EDITOR" || role === "VIEWER";
}
