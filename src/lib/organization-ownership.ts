import { Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import {
  OrganizationAccessError,
  requireOrganizationPermission,
} from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

const TRANSFER_TTL_MS = 7 * 24 * 60 * 60_000;

type Actor = {
  id: string;
  firstName: string;
  lastName: string;
};
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createOwnershipTransfer(
  actor: Actor,
  organizationId: string,
  targetUserId: string,
  meta: RequestMeta = {},
) {
  if (actor.id === targetUserId) {
    throw new OrganizationError("Select another active team member.");
  }
  const result = await prisma.$transaction(
    async (tx) => {
      await requireOrganizationPermission(
        actor.id,
        { id: organizationId },
        "ORGANIZATION_TRANSFER_OWNERSHIP",
        tx,
      );
      const target = await tx.organizationMembership.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: targetUserId },
        },
        select: {
          role: true,
          status: true,
          user: { select: { status: true } },
        },
      });
      if (
        !target ||
        target.status !== "ACTIVE" ||
        target.user.status !== "ACTIVE" ||
        target.role === "OWNER"
      ) {
        throw new OrganizationError(
          "Ownership can be transferred only to an eligible active member.",
          409,
        );
      }
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { slug: true, publicName: true, lifecycleStatus: true },
      });
      if (organization.lifecycleStatus !== "ACTIVE") {
        throw new OrganizationError(
          "Ownership transfer requires an active organization.",
          409,
        );
      }
      await tx.organizationOwnershipTransfer.updateMany({
        where: {
          organizationId,
          status: "PENDING",
          expiresAt: { lte: new Date() },
        },
        data: { status: "EXPIRED" },
      });
      const existing = await tx.organizationOwnershipTransfer.findFirst({
        where: { organizationId, status: "PENDING" },
        select: { id: true },
      });
      if (existing) {
        throw new OrganizationError(
          "An ownership transfer is already awaiting a response.",
          409,
        );
      }
      const transfer = await tx.organizationOwnershipTransfer.create({
        data: {
          organizationId,
          initiatedByUserId: actor.id,
          targetUserId,
          expiresAt: new Date(Date.now() + TRANSFER_TTL_MS),
        },
      });
      await enqueueNotificationJobWithClient(tx, {
        recipientId: targetUserId,
        actorId: actor.id,
        type: "ACCOUNT",
        templateKey: "ORGANIZATION_OWNERSHIP_TRANSFER",
        data: {
          organizationName: organization.publicName,
          outcome: "ownership was offered to you",
        },
        href: `/organizations/${organization.slug}/settings`,
        dedupeKey: `organization-transfer:${transfer.id}:pending`,
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId,
        action: "ORGANIZATION_OWNERSHIP_TRANSFER_REQUESTED",
        entityType: "OrganizationOwnershipTransfer",
        entityId: transfer.id,
        newValue: {
          targetUserId,
          status: transfer.status,
          expiresAt: transfer.expiresAt,
        },
        ...meta,
      });
      return {
        id: transfer.id,
        status: transfer.status,
        expiresAt: transfer.expiresAt.toISOString(),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFER_REQUESTED,
  });
  return result;
}

export async function decideOwnershipTransfer(
  actor: Actor,
  transferId: string,
  action: "ACCEPT" | "DECLINE" | "CANCEL",
  meta: RequestMeta = {},
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const transfer = await tx.organizationOwnershipTransfer.findUnique({
        where: { id: transferId },
        include: {
          organization: {
            select: { id: true, slug: true, publicName: true },
          },
        },
      });
      if (!transfer) throw new OrganizationError("Transfer not found.", 404);
      if (transfer.status !== "PENDING") {
        throw new OrganizationError(
          "This ownership transfer is no longer pending.",
          409,
        );
      }
      if (transfer.expiresAt <= new Date()) {
        await tx.organizationOwnershipTransfer.update({
          where: { id: transfer.id },
          data: { status: "EXPIRED" },
        });
        return { status: "EXPIRED" as const };
      }
      if (action === "CANCEL" && actor.id !== transfer.initiatedByUserId) {
        throw new OrganizationAccessError(
          "Only the current owner can cancel this transfer.",
          403,
        );
      }
      if (action !== "CANCEL" && actor.id !== transfer.targetUserId) {
        throw new OrganizationAccessError(
          "Only the selected team member can answer this transfer.",
          403,
        );
      }
      if (action !== "ACCEPT") {
        const status = action === "CANCEL" ? "CANCELLED" : "DECLINED";
        await tx.organizationOwnershipTransfer.update({
          where: { id: transfer.id },
          data: { status, cancelledAt: new Date() },
        });
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          organizationId: transfer.organizationId,
          action: `ORGANIZATION_OWNERSHIP_TRANSFER_${status}`,
          entityType: "OrganizationOwnershipTransfer",
          entityId: transfer.id,
          ...meta,
        });
        return { status };
      }

      const memberships = await tx.organizationMembership.findMany({
        where: {
          organizationId: transfer.organizationId,
          userId: {
            in: [transfer.initiatedByUserId, transfer.targetUserId],
          },
          status: "ACTIVE",
        },
        select: { userId: true, role: true },
      });
      const owner = memberships.find(
        (membership) =>
          membership.userId === transfer.initiatedByUserId &&
          membership.role === "OWNER",
      );
      const target = memberships.find(
        (membership) => membership.userId === transfer.targetUserId,
      );
      if (!owner || !target) {
        throw new OrganizationError(
          "The team changed and this transfer can no longer be accepted.",
          409,
        );
      }
      await tx.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId: transfer.organizationId,
            userId: transfer.initiatedByUserId,
          },
        },
        data: { role: "ADMIN" },
      });
      await tx.organizationMembership.update({
        where: {
          organizationId_userId: {
            organizationId: transfer.organizationId,
            userId: transfer.targetUserId,
          },
        },
        data: { role: "OWNER" },
      });
      await tx.organizationOwnershipTransfer.update({
        where: { id: transfer.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await enqueueNotificationJobWithClient(tx, {
        recipientId: transfer.initiatedByUserId,
        actorId: actor.id,
        type: "ACCOUNT",
        templateKey: "ORGANIZATION_OWNERSHIP_TRANSFER",
        data: {
          organizationName: transfer.organization.publicName,
          outcome: "the transfer was accepted",
        },
        href: `/organizations/${transfer.organization.slug}/team`,
        dedupeKey: `organization-transfer:${transfer.id}:accepted`,
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId: transfer.organizationId,
        action: "ORGANIZATION_OWNERSHIP_TRANSFER_COMPLETED",
        entityType: "OrganizationOwnershipTransfer",
        entityId: transfer.id,
        oldValue: {
          ownerUserId: transfer.initiatedByUserId,
          status: transfer.status,
        },
        newValue: {
          ownerUserId: transfer.targetUserId,
          status: "ACCEPTED",
        },
        ...meta,
      });
      return {
        status: "ACCEPTED" as const,
        slug: transfer.organization.slug,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  if (result.status === "EXPIRED") {
    throw new OrganizationError("This ownership transfer has expired.", 410);
  }
  if (action === "ACCEPT") {
    await captureServerProductEvent({
      distinctId: actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_OWNERSHIP_TRANSFER_COMPLETED,
    });
  }
  return result;
}

export async function getPendingOwnershipTransfers(
  actorId: string,
  organizationId: string,
) {
  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: actorId },
    },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "ACTIVE") return [];
  const transfers = await prisma.organizationOwnershipTransfer.findMany({
    where: {
      organizationId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
      OR: [{ initiatedByUserId: actorId }, { targetUserId: actorId }],
    },
    select: {
      id: true,
      initiatedByUserId: true,
      targetUserId: true,
      status: true,
      expiresAt: true,
      targetUser: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return transfers.map((transfer) => ({
    ...transfer,
    expiresAt: transfer.expiresAt.toISOString(),
  }));
}
