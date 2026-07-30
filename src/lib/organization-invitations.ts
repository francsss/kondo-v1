import { createHash, randomBytes } from "node:crypto";
import type {
  OrganizationInvitationStatus,
  OrganizationMembershipRole,
  Prisma,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import {
  OrganizationAccessError,
  requireOrganizationPermission,
} from "@/lib/organization-permissions";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

const INVITATION_TTL_MS = 7 * 24 * 60 * 60_000;
const INVITABLE_ROLES: OrganizationMembershipRole[] = [
  "ADMIN",
  "EDITOR",
  "VIEWER",
];

type Actor = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function invitationHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function newInvitationToken() {
  return randomBytes(32).toString("base64url");
}

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function invitationBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function assertInvitableRole(role: OrganizationMembershipRole) {
  if (!INVITABLE_ROLES.includes(role)) {
    throw new OrganizationError("Select an eligible organization role.");
  }
}

export async function listOrganizationTeam(
  actorId: string,
  organizationId: string,
) {
  await requireOrganizationPermission(
    actorId,
    { id: organizationId },
    "ORGANIZATION_MANAGE_TEAM",
  );
  const [members, invitations] = await Promise.all([
    prisma.organizationMembership.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        userId: true,
        role: true,
        status: true,
        joinedAt: true,
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
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      take: 200,
    }),
    prisma.organizationInvitation.findMany({
      where: { organizationId, status: "PENDING" },
      select: {
        id: true,
        emailNormalized: true,
        intendedRole: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return {
    members: members.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })),
  };
}

export async function createOrganizationInvitation(
  actor: Actor,
  organizationId: string,
  input: { email: string; role: OrganizationMembershipRole },
  meta: RequestMeta = {},
) {
  assertInvitableRole(input.role);
  const email = normalizedEmail(input.email);
  const rawToken = newInvitationToken();
  const tokenHash = invitationHash(rawToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actor.id,
      { id: organizationId },
      "ORGANIZATION_INVITE_MEMBERS",
      tx,
    );
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        slug: true,
        publicName: true,
        lifecycleStatus: true,
      },
    });
    if (!organization)
      throw new OrganizationError("Organization not found.", 404);
    if (organization.lifecycleStatus !== "ACTIVE") {
      throw new OrganizationError(
        "Invitations are available only for active organizations.",
        409,
      );
    }
    const existingMember = await tx.organizationMembership.findFirst({
      where: {
        organizationId,
        user: { email },
        status: "ACTIVE",
      },
      select: { userId: true },
    });
    if (existingMember) {
      return { organization, invitation: null };
    }
    const pending = await tx.organizationInvitation.findFirst({
      where: { organizationId, emailNormalized: email, status: "PENDING" },
      select: { id: true },
    });
    const invitation = pending
      ? await tx.organizationInvitation.update({
          where: { id: pending.id },
          data: {
            intendedRole: input.role,
            tokenHash,
            invitedByUserId: actor.id,
            expiresAt,
          },
        })
      : await tx.organizationInvitation.create({
          data: {
            organizationId,
            emailNormalized: email,
            intendedRole: input.role,
            tokenHash,
            invitedByUserId: actor.id,
            expiresAt,
          },
        });
    const recipient = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (recipient) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: recipient.id,
        actorId: actor.id,
        type: "ACCOUNT",
        templateKey: "ORGANIZATION_INVITATION",
        data: {
          organizationName: organization.publicName,
          role: input.role,
        },
        href: "/organization-invitations",
        dedupeKey: `organization-invitation:${invitation.id}:${invitation.updatedAt.getTime()}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: pending
        ? "ORGANIZATION_INVITATION_RESENT"
        : "ORGANIZATION_INVITATION_CREATED",
      entityType: "OrganizationInvitation",
      entityId: invitation.id,
      newValue: {
        role: invitation.intendedRole,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
      ...meta,
    });
    return { organization, invitation };
  });

  if (result.invitation) {
    try {
      await sendTransactionalEmail({
        to: email,
        subject: `Join ${result.organization.publicName} on Kondo`,
        text: [
          `${actor.firstName} ${actor.lastName} invited you to join ${result.organization.publicName} as ${input.role.toLowerCase()}.`,
          "",
          `${invitationBaseUrl()}/organization-invitations/${rawToken}`,
          "",
          "Sign in with this email address or create your normal personal Kondo account to accept. The organization never receives a shared password.",
        ].join("\n"),
      });
    } catch (error) {
      await prisma.organizationInvitation.updateMany({
        where: {
          id: result.invitation.id,
          status: "PENDING",
          tokenHash,
        },
        data: { status: "REVOKED" },
      });
      throw error;
    }
    await captureServerProductEvent({
      distinctId: actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_INVITATION_SENT,
      properties: { organization_role: input.role },
    });
  }
  return {
    accepted: true,
    message:
      "If this address can be invited, Kondo has sent the organization invitation.",
  };
}

export async function getOrganizationInvitationPreview(token: string) {
  const invitation = await prisma.organizationInvitation.findUnique({
    where: { tokenHash: invitationHash(token) },
    select: {
      id: true,
      intendedRole: true,
      status: true,
      expiresAt: true,
      organization: {
        select: {
          publicName: true,
          type: true,
          logoMediaId: true,
          lifecycleStatus: true,
        },
      },
      invitedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });
  if (!invitation) throw new OrganizationError("Invitation not found.", 404);
  const status: OrganizationInvitationStatus =
    invitation.status === "PENDING" && invitation.expiresAt <= new Date()
      ? "EXPIRED"
      : invitation.status;
  return {
    ...invitation,
    status,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

export async function listPendingOrganizationInvitations(email: string) {
  const invitations = await prisma.organizationInvitation.findMany({
    where: {
      emailNormalized: normalizedEmail(email),
      status: "PENDING",
      expiresAt: { gt: new Date() },
      organization: { lifecycleStatus: "ACTIVE" },
    },
    select: {
      id: true,
      intendedRole: true,
      expiresAt: true,
      createdAt: true,
      organization: {
        select: {
          slug: true,
          publicName: true,
          type: true,
          logoMediaId: true,
        },
      },
      invitedBy: {
        select: { firstName: true, lastName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return invitations.map((invitation) => ({
    ...invitation,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  }));
}

export async function decideOrganizationInvitation(
  actor: Actor,
  token: string,
  action: "ACCEPT" | "DECLINE",
  meta: RequestMeta = {},
) {
  return decideOrganizationInvitationLookup(
    actor,
    { tokenHash: invitationHash(token) },
    action,
    meta,
  );
}

export async function decideOrganizationInvitationById(
  actor: Actor,
  invitationId: string,
  action: "ACCEPT" | "DECLINE",
  meta: RequestMeta = {},
) {
  return decideOrganizationInvitationLookup(
    actor,
    { id: invitationId },
    action,
    meta,
  );
}

async function decideOrganizationInvitationLookup(
  actor: Actor,
  where: Prisma.OrganizationInvitationWhereUniqueInput,
  action: "ACCEPT" | "DECLINE",
  meta: RequestMeta,
) {
  const result = await prisma.$transaction(
    async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where,
        include: {
          organization: {
            select: {
              id: true,
              slug: true,
              publicName: true,
              lifecycleStatus: true,
            },
          },
        },
      });
      if (!invitation)
        throw new OrganizationError("Invitation not found.", 404);
      if (invitation.status !== "PENDING") {
        throw new OrganizationError(
          "This invitation has already been used or cancelled.",
          409,
        );
      }
      if (invitation.expiresAt <= new Date()) {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: "EXPIRED" },
        });
        return {
          status: "EXPIRED" as const,
          slug: invitation.organization.slug,
        };
      }
      if (normalizedEmail(actor.email) !== invitation.emailNormalized) {
        throw new OrganizationAccessError(
          "Sign in with the email address that received this invitation.",
          403,
        );
      }
      if (invitation.organization.lifecycleStatus !== "ACTIVE") {
        throw new OrganizationError(
          "This organization cannot accept new members right now.",
          409,
        );
      }
      if (action === "DECLINE") {
        await tx.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: "DECLINED", declinedAt: new Date() },
        });
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          organizationId: invitation.organizationId,
          action: "ORGANIZATION_INVITATION_DECLINED",
          entityType: "OrganizationInvitation",
          entityId: invitation.id,
          ...meta,
        });
        return {
          status: "DECLINED" as const,
          slug: invitation.organization.slug,
        };
      }

      await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: actor.id,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId: actor.id,
          role: invitation.intendedRole,
          status: "ACTIVE",
        },
        update: {
          role: invitation.intendedRole,
          status: "ACTIVE",
          joinedAt: new Date(),
          removedAt: null,
          removedById: null,
        },
      });
      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      await enqueueNotificationJobWithClient(tx, {
        recipientId: invitation.invitedByUserId,
        actorId: actor.id,
        type: "ACCOUNT",
        templateKey: "ORGANIZATION_INVITATION_ACCEPTED",
        data: {
          actorName: `${actor.firstName} ${actor.lastName}`,
          organizationName: invitation.organization.publicName,
        },
        href: `/organizations/${invitation.organization.slug}/team`,
        dedupeKey: `organization-invitation-accepted:${invitation.id}`,
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId: invitation.organizationId,
        action: "ORGANIZATION_INVITATION_ACCEPTED",
        entityType: "OrganizationMembership",
        entityId: `${invitation.organizationId}:${actor.id}`,
        newValue: { role: invitation.intendedRole, status: "ACTIVE" },
        ...meta,
      });
      return {
        status: "ACCEPTED" as const,
        slug: invitation.organization.slug,
      };
    },
    {
      isolationLevel: "Serializable",
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  if (result.status === "EXPIRED") {
    throw new OrganizationError("This invitation has expired.", 410);
  }
  await captureServerProductEvent({
    distinctId: actor.id,
    event:
      action === "ACCEPT"
        ? PRODUCT_EVENTS.ORGANIZATION_INVITATION_ACCEPTED
        : PRODUCT_EVENTS.ORGANIZATION_INVITATION_DECLINED,
  });
  return result;
}

export async function cancelOrganizationInvitation(
  actorId: string,
  organizationId: string,
  invitationId: string,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    await requireOrganizationPermission(
      actorId,
      { id: organizationId },
      "ORGANIZATION_INVITE_MEMBERS",
      tx,
    );
    const invitation = await tx.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId, status: "PENDING" },
    });
    if (!invitation) {
      throw new OrganizationError("Pending invitation not found.", 404);
    }
    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    await writeAuditLogWithClient(tx, {
      actorId,
      organizationId,
      action: "ORGANIZATION_INVITATION_CANCELLED",
      entityType: "OrganizationInvitation",
      entityId: invitation.id,
      ...meta,
    });
  });
}

export async function resendOrganizationInvitation(
  actor: Actor,
  organizationId: string,
  invitationId: string,
  role?: OrganizationMembershipRole,
  meta: RequestMeta = {},
) {
  await requireOrganizationPermission(
    actor.id,
    { id: organizationId },
    "ORGANIZATION_INVITE_MEMBERS",
  );
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { id: invitationId, organizationId, status: "PENDING" },
    select: { emailNormalized: true, intendedRole: true },
  });
  if (!invitation) {
    throw new OrganizationError("Pending invitation not found.", 404);
  }
  return createOrganizationInvitation(
    actor,
    organizationId,
    {
      email: invitation.emailNormalized,
      role: role ?? invitation.intendedRole,
    },
    meta,
  );
}
