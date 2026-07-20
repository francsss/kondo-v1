import {
  Prisma,
  type CommunityAccessStatus,
  type CommunityJoinPolicy,
  type CommunityStatus,
  type CommunityType,
  type MembershipRole,
  type PostType,
  type ReactionType,
  type ReportReason,
} from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  hasAdminPermission,
  type AppRole,
} from "@/lib/authorization";
import {
  communityVisibilityWhere,
  publishedPostVisibilityWhere,
} from "@/lib/content-visibility";
import { attachMediaAsset, MediaError } from "@/lib/media";
import {
  enqueueNotificationJobWithClient,
  enqueuePostCommentNotification,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const ACTIVE_REPORT_STATUSES = ["OPEN", "REVIEWING"] as const;

type CommunityActor = {
  id: string;
  role: AppRole | string;
};

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class CommunityError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CommunityError";
  }
}

function slugBase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

async function uniqueCommunitySlug(name: string) {
  const base = slugBase(name) || "community";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const exists = await prisma.community.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }
  throw new CommunityError("Could not create a unique community URL.", 409);
}

function localStaff(role: MembershipRole | string | null | undefined) {
  return role === "OWNER" || role === "MODERATOR";
}

function canManageCommunity(
  actor: CommunityActor,
  membershipRole: MembershipRole | string | null | undefined,
) {
  return (
    localStaff(membershipRole) ||
    hasAdminPermission(actor.role, "COMMUNITY_CMS_MANAGE")
  );
}

function canOwnCommunity(
  actor: CommunityActor,
  membershipRole: MembershipRole | string | null | undefined,
) {
  return (
    membershipRole === "OWNER" ||
    hasAdminPermission(actor.role, "COMMUNITY_CMS_MANAGE")
  );
}

async function resolveCommunityLocation(input: {
  type: CommunityType;
  countryId?: string | null;
  cityId?: string | null;
  universityId?: string | null;
}) {
  if (input.type === "TOPIC") {
    return { countryId: null, cityId: null, universityId: null };
  }
  if (input.type === "COUNTRY") {
    const country = input.countryId
      ? await prisma.country.findFirst({
          where: { id: input.countryId, isActive: true },
          select: { id: true },
        })
      : null;
    if (!country) throw new CommunityError("Country not found.", 404);
    return { countryId: country.id, cityId: null, universityId: null };
  }
  if (input.type === "CITY") {
    const city = input.cityId
      ? await prisma.city.findFirst({
          where: { id: input.cityId, isActive: true },
          select: { id: true, countryId: true },
        })
      : null;
    if (!city) throw new CommunityError("City not found.", 404);
    return {
      countryId: city.countryId,
      cityId: city.id,
      universityId: null,
    };
  }
  const university = input.universityId
    ? await prisma.university.findFirst({
        where: { id: input.universityId, isActive: true, verified: true },
        select: { id: true, cityId: true, countryId: true },
      })
    : null;
  if (!university) {
    throw new CommunityError("Verified university not found.", 404);
  }
  return {
    countryId: university.countryId,
    cityId: university.cityId,
    universityId: university.id,
  };
}

async function attachCommunityCover(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    communityId: string;
    mediaId: string;
    previousMediaId?: string | null;
  },
) {
  try {
    await attachMediaAsset(tx, {
      ownerId: input.actorId,
      assetId: input.mediaId,
      purpose: "COMMUNITY_COVER",
      attachmentType: "COMMUNITY",
      attachmentId: input.communityId,
    });
  } catch (error) {
    if (error instanceof MediaError) {
      throw new CommunityError(error.message, error.status);
    }
    throw error;
  }
  await tx.community.update({
    where: { id: input.communityId },
    data: { coverMediaId: input.mediaId },
  });
  if (input.previousMediaId && input.previousMediaId !== input.mediaId) {
    await tx.mediaAsset.updateMany({
      where: {
        id: input.previousMediaId,
        attachmentType: "COMMUNITY",
        attachmentId: input.communityId,
        retainedAt: null,
      },
      data: { attachedAt: null, attachmentType: null, attachmentId: null },
    });
  }
}

async function attachPostMedia(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    postId: string;
    mediaIds: string[];
  },
) {
  const uniqueIds = [...new Set(input.mediaIds)];
  if (uniqueIds.length !== input.mediaIds.length) {
    throw new CommunityError("A post cannot attach the same image twice.");
  }
  const existing = await tx.postMedia.findMany({
    where: { postId: input.postId },
    select: { mediaId: true },
  });
  const oldIds = existing.map(({ mediaId }) => mediaId);
  if (oldIds.length) {
    await tx.postMedia.deleteMany({ where: { postId: input.postId } });
    await tx.mediaAsset.updateMany({
      where: {
        id: { in: oldIds.filter((id) => !uniqueIds.includes(id)) },
        attachmentType: "POST",
        attachmentId: input.postId,
        retainedAt: null,
      },
      data: { attachedAt: null, attachmentType: null, attachmentId: null },
    });
  }
  for (const [order, mediaId] of uniqueIds.entries()) {
    try {
      await attachMediaAsset(tx, {
        ownerId: input.actorId,
        assetId: mediaId,
        purpose: "POST_IMAGE",
        attachmentType: "POST",
        attachmentId: input.postId,
      });
    } catch (error) {
      if (error instanceof MediaError) {
        throw new CommunityError(error.message, error.status);
      }
      throw error;
    }
    await tx.postMedia.create({
      data: { postId: input.postId, mediaId, order },
    });
  }
}

function safeCommunityDto(community: {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: CommunityType;
  status: CommunityStatus;
  joinPolicy: CommunityJoinPolicy;
  icon: string | null;
  coverMediaId: string | null;
  isVerified: boolean;
  isPrivate: boolean;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...community,
    coverUrl: community.coverMediaId
      ? `/api/media/${community.coverMediaId}`
      : null,
    createdAt: community.createdAt.toISOString(),
    updatedAt: community.updatedAt.toISOString(),
  };
}

export async function createCommunity(input: {
  actor: CommunityActor;
  data: {
    name: string;
    description: string;
    type: CommunityType;
    icon?: string | null;
    isPrivate: boolean;
    joinPolicy: CommunityJoinPolicy;
    countryId?: string | null;
    cityId?: string | null;
    universityId?: string | null;
    coverMediaId?: string | null;
  };
  meta?: RequestMeta;
}) {
  const [slug, location] = await Promise.all([
    uniqueCommunitySlug(input.data.name),
    resolveCommunityLocation(input.data),
  ]);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          slug,
          name: input.data.name,
          description: input.data.description,
          type: input.data.type,
          status: "PENDING_REVIEW",
          joinPolicy: input.data.joinPolicy,
          icon: input.data.icon ?? null,
          isPrivate: input.data.isPrivate,
          createdById: input.actor.id,
          ownerId: input.actor.id,
          ...location,
          members: {
            create: { userId: input.actor.id, role: "OWNER" },
          },
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          type: true,
          status: true,
          joinPolicy: true,
          icon: true,
          coverMediaId: true,
          isVerified: true,
          isPrivate: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (input.data.coverMediaId) {
        await attachCommunityCover(tx, {
          actorId: input.actor.id,
          communityId: community.id,
          mediaId: input.data.coverMediaId,
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMUNITY_CREATED",
        entityType: "Community",
        entityId: community.id,
        newValue: {
          name: community.name,
          type: community.type,
          status: community.status,
          joinPolicy: community.joinPolicy,
          isPrivate: community.isPrivate,
        },
        ...input.meta,
      });
      return {
        community: safeCommunityDto({
          ...community,
          coverMediaId: input.data.coverMediaId ?? null,
        }),
      };
    });
    await trackEvent({
      name: "COMMUNITY_CREATED",
      userId: input.actor.id,
      properties: { communityId: result.community.id, type: input.data.type },
    });
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CommunityError("A community with this identity exists.", 409);
    }
    throw error;
  }
}

export async function updateCommunity(input: {
  actor: CommunityActor;
  communityId: string;
  data: {
    name?: string;
    description?: string;
    icon?: string | null;
    isPrivate?: boolean;
    joinPolicy?: CommunityJoinPolicy;
    countryId?: string | null;
    cityId?: string | null;
    universityId?: string | null;
    coverMediaId?: string | null;
  };
  meta?: RequestMeta;
}) {
  const current = await prisma.community.findUnique({
    where: { id: input.communityId },
    select: {
      id: true,
      type: true,
      ownerId: true,
      coverMediaId: true,
      countryId: true,
      cityId: true,
      universityId: true,
      members: {
        where: { userId: input.actor.id },
        select: { role: true },
      },
    },
  });
  if (!current) throw new CommunityError("Community not found.", 404);
  if (!canOwnCommunity(input.actor, current.members[0]?.role)) {
    throw new CommunityError("Only the owner can edit this community.", 403);
  }
  const location = await resolveCommunityLocation({
    type: current.type,
    countryId:
      input.data.countryId === undefined
        ? current.countryId
        : input.data.countryId,
    cityId:
      input.data.cityId === undefined ? current.cityId : input.data.cityId,
    universityId:
      input.data.universityId === undefined
        ? current.universityId
        : input.data.universityId,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.community.update({
      where: { id: current.id },
      data: {
        name: input.data.name,
        description: input.data.description,
        icon: input.data.icon,
        isPrivate: input.data.isPrivate,
        joinPolicy: input.data.joinPolicy,
        ...location,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        type: true,
        status: true,
        joinPolicy: true,
        icon: true,
        coverMediaId: true,
        isVerified: true,
        isPrivate: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (
      input.data.coverMediaId &&
      input.data.coverMediaId !== current.coverMediaId
    ) {
      await attachCommunityCover(tx, {
        actorId: input.actor.id,
        communityId: current.id,
        mediaId: input.data.coverMediaId,
        previousMediaId: current.coverMediaId,
      });
    }
    if (input.data.coverMediaId === null && current.coverMediaId) {
      await tx.community.update({
        where: { id: current.id },
        data: { coverMediaId: null },
      });
      await tx.mediaAsset.updateMany({
        where: {
          id: current.coverMediaId,
          attachmentType: "COMMUNITY",
          attachmentId: current.id,
          retainedAt: null,
        },
        data: { attachedAt: null, attachmentType: null, attachmentId: null },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_UPDATED",
      entityType: "Community",
      entityId: current.id,
      newValue: {
        changedFields: Object.keys(input.data),
      },
      ...input.meta,
    });
    return {
      community: safeCommunityDto({
        ...updated,
        coverMediaId:
          input.data.coverMediaId === undefined
            ? updated.coverMediaId
            : input.data.coverMediaId,
      }),
    };
  });
}

export async function transferCommunityOwnership(input: {
  actor: CommunityActor;
  communityId: string;
  targetUserId: string;
  meta?: RequestMeta;
}) {
  if (input.actor.id === input.targetUserId) {
    throw new CommunityError("You already own this community.", 409);
  }
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.findUnique({
      where: { id: input.communityId },
      select: {
        id: true,
        ownerId: true,
        members: {
          where: { userId: { in: [input.actor.id, input.targetUserId] } },
          select: { id: true, userId: true, role: true },
        },
      },
    });
    if (!community) throw new CommunityError("Community not found.", 404);
    const actorMembership = community.members.find(
      ({ userId }) => userId === input.actor.id,
    );
    if (!canOwnCommunity(input.actor, actorMembership?.role)) {
      throw new CommunityError("Only the owner can transfer ownership.", 403);
    }
    const target = community.members.find(
      ({ userId }) => userId === input.targetUserId,
    );
    if (!target) {
      throw new CommunityError(
        "The new owner must already be a community member.",
        409,
      );
    }
    await tx.community.update({
      where: { id: community.id },
      data: { ownerId: target.userId },
    });
    await tx.communityMember.updateMany({
      where: { communityId: community.id, role: "OWNER" },
      data: { role: "MODERATOR" },
    });
    await tx.communityMember.update({
      where: { id: target.id },
      data: { role: "OWNER" },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_OWNERSHIP_TRANSFERRED",
      entityType: "Community",
      entityId: community.id,
      oldValue: { ownerId: community.ownerId },
      newValue: { ownerId: target.userId },
      ...input.meta,
    });
    return { ownerId: target.userId };
  });
}

export async function archiveOwnedCommunity(input: {
  actor: CommunityActor;
  communityId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.findUnique({
      where: { id: input.communityId },
      select: {
        id: true,
        status: true,
        members: {
          where: { userId: input.actor.id },
          select: { role: true },
        },
      },
    });
    if (!community) throw new CommunityError("Community not found.", 404);
    if (!canOwnCommunity(input.actor, community.members[0]?.role)) {
      throw new CommunityError("Only the owner can archive this community.", 403);
    }
    if (community.status !== "ARCHIVED") {
      await tx.community.update({
        where: { id: community.id },
        data: { status: "ARCHIVED", moderatedAt: new Date() },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMUNITY_ARCHIVED",
        entityType: "Community",
        entityId: community.id,
        oldValue: { status: community.status },
        newValue: { status: "ARCHIVED" },
        ...input.meta,
      });
    }
    return { archived: true };
  });
}

export async function updateCommunityMemberRole(input: {
  actor: CommunityActor;
  communityId: string;
  memberId: string;
  role: Exclude<MembershipRole, "OWNER">;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const [actorMembership, target] = await Promise.all([
      tx.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: input.actor.id,
          },
        },
        select: { role: true },
      }),
      tx.communityMember.findUnique({
        where: { id: input.memberId },
        select: { id: true, communityId: true, userId: true, role: true },
      }),
    ]);
    if (!target || target.communityId !== input.communityId) {
      throw new CommunityError("Member not found.", 404);
    }
    if (!canOwnCommunity(input.actor, actorMembership?.role)) {
      throw new CommunityError("Only the owner can change member roles.", 403);
    }
    if (target.role === "OWNER") {
      throw new CommunityError("Transfer ownership before changing this role.", 409);
    }
    const updated = await tx.communityMember.update({
      where: { id: target.id },
      data: { role: input.role },
      select: { id: true, userId: true, role: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_MEMBER_ROLE_UPDATED",
      entityType: "Community",
      entityId: input.communityId,
      oldValue: { memberId: target.id, role: target.role },
      newValue: { memberId: target.id, role: updated.role },
      ...input.meta,
    });
    return { member: updated };
  });
}

export async function removeCommunityMember(input: {
  actor: CommunityActor;
  communityId: string;
  memberId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const [actorMembership, target] = await Promise.all([
      tx.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: input.actor.id,
          },
        },
        select: { role: true },
      }),
      tx.communityMember.findUnique({
        where: { id: input.memberId },
        select: { id: true, communityId: true, userId: true, role: true },
      }),
    ]);
    if (!target || target.communityId !== input.communityId) {
      throw new CommunityError("Member not found.", 404);
    }
    if (!canManageCommunity(input.actor, actorMembership?.role)) {
      throw new CommunityError("Community staff permission required.", 403);
    }
    if (target.role === "OWNER") {
      throw new CommunityError("Transfer ownership before removing the owner.", 409);
    }
    if (
      actorMembership?.role === "MODERATOR" &&
      target.role === "MODERATOR" &&
      !hasAdminPermission(input.actor.role, "COMMUNITY_CMS_MANAGE")
    ) {
      throw new CommunityError("Only the owner can remove a moderator.", 403);
    }
    await tx.communityMember.delete({ where: { id: target.id } });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_MEMBER_REMOVED",
      entityType: "Community",
      entityId: input.communityId,
      newValue: { memberId: target.id, userId: target.userId },
      ...input.meta,
    });
    return { removed: true };
  });
}

export async function requestCommunityAccess(input: {
  actor: CommunityActor;
  communityId: string;
  note?: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const community = await tx.community.findFirst({
      where: {
        id: input.communityId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        joinPolicy: true,
        members: {
          where: { userId: input.actor.id },
          select: { id: true },
        },
      },
    });
    if (!community) throw new CommunityError("Community not found.", 404);
    if (community.members.length) return { state: "JOINED" as const };

    if (community.joinPolicy === "OPEN") {
      await tx.communityMember.create({
        data: { communityId: community.id, userId: input.actor.id },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMUNITY_JOINED",
        entityType: "Community",
        entityId: community.id,
        ...input.meta,
      });
      return { state: "JOINED" as const };
    }

    if (community.joinPolicy === "INVITE_ONLY") {
      const invitation = await tx.communityAccessRequest.findUnique({
        where: {
          communityId_userId_type: {
            communityId: community.id,
            userId: input.actor.id,
            type: "INVITATION",
          },
        },
      });
      if (!invitation || invitation.status !== "PENDING") {
        throw new CommunityError("This community requires an invitation.", 403);
      }
      await tx.communityMember.create({
        data: { communityId: community.id, userId: input.actor.id },
      });
      await tx.communityAccessRequest.update({
        where: { id: invitation.id },
        data: {
          status: "APPROVED",
          resolvedById: input.actor.id,
          resolvedAt: new Date(),
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMUNITY_INVITATION_ACCEPTED",
        entityType: "Community",
        entityId: community.id,
        ...input.meta,
      });
      return { state: "JOINED" as const };
    }

    const request = await tx.communityAccessRequest.upsert({
      where: {
        communityId_userId_type: {
          communityId: community.id,
          userId: input.actor.id,
          type: "JOIN_REQUEST",
        },
      },
      create: {
        communityId: community.id,
        userId: input.actor.id,
        createdById: input.actor.id,
        type: "JOIN_REQUEST",
        note: input.note,
      },
      update: {
        status: "PENDING",
        note: input.note,
        resolution: null,
        resolvedAt: null,
        resolvedById: null,
      },
      select: { id: true, status: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_JOIN_REQUESTED",
      entityType: "Community",
      entityId: community.id,
      newValue: { requestId: request.id },
      ...input.meta,
    });
    return { state: "PENDING" as const, requestId: request.id };
  });
}

export async function leaveCommunity(input: {
  actor: CommunityActor;
  communityId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const membership = await tx.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: input.communityId,
          userId: input.actor.id,
        },
      },
    });
    if (!membership) return { left: true };
    if (membership.role === "OWNER") {
      throw new CommunityError("Transfer ownership before leaving.", 409);
    }
    await tx.communityMember.delete({ where: { id: membership.id } });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_LEFT",
      entityType: "Community",
      entityId: input.communityId,
      ...input.meta,
    });
    return { left: true };
  });
}

export async function inviteCommunityMember(input: {
  actor: CommunityActor;
  communityId: string;
  userId: string;
  note?: string;
  meta?: RequestMeta;
}) {
  if (input.actor.id === input.userId) {
    throw new CommunityError("You cannot invite yourself.");
  }
  return prisma.$transaction(async (tx) => {
    const [community, target] = await Promise.all([
      tx.community.findUnique({
        where: { id: input.communityId },
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          members: {
            where: { userId: input.actor.id },
            select: { role: true },
          },
        },
      }),
      tx.user.findFirst({
        where: { id: input.userId, status: "ACTIVE" },
        select: { id: true },
      }),
    ]);
    if (!community || community.status === "REMOVED") {
      throw new CommunityError("Community not found.", 404);
    }
    if (!target) throw new CommunityError("User not found.", 404);
    if (!canManageCommunity(input.actor, community.members[0]?.role)) {
      throw new CommunityError("Community staff permission required.", 403);
    }
    const member = await tx.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: target.id,
        },
      },
      select: { id: true },
    });
    if (member) throw new CommunityError("This user is already a member.", 409);
    const invitation = await tx.communityAccessRequest.upsert({
      where: {
        communityId_userId_type: {
          communityId: community.id,
          userId: target.id,
          type: "INVITATION",
        },
      },
      create: {
        communityId: community.id,
        userId: target.id,
        createdById: input.actor.id,
        type: "INVITATION",
        note: input.note,
      },
      update: {
        status: "PENDING",
        note: input.note,
        createdById: input.actor.id,
        resolution: null,
        resolvedAt: null,
        resolvedById: null,
      },
      select: { id: true },
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: target.id,
      actorId: input.actor.id,
      type: "COMMUNITY_ANNOUNCEMENT",
      templateKey: "ADMIN_ANNOUNCEMENT",
      data: {
        title: `Invitation to ${community.name}`,
        body: input.note || "Community staff invited you to join.",
      },
      href: `/communities/${community.slug}`,
      dedupeKey: `community-invitation:${invitation.id}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_INVITATION_CREATED",
      entityType: "Community",
      entityId: community.id,
      newValue: { invitationId: invitation.id, userId: target.id },
      ...input.meta,
    });
    return { invitationId: invitation.id, status: "PENDING" as const };
  });
}

export async function resolveCommunityAccess(input: {
  actor: CommunityActor;
  communityId: string;
  requestId: string;
  status: Extract<CommunityAccessStatus, "APPROVED" | "REJECTED">;
  resolution?: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const [actorMembership, request] = await Promise.all([
      tx.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: input.communityId,
            userId: input.actor.id,
          },
        },
        select: { role: true },
      }),
      tx.communityAccessRequest.findUnique({
        where: { id: input.requestId },
        select: {
          id: true,
          communityId: true,
          userId: true,
          type: true,
          status: true,
          community: { select: { slug: true, name: true } },
        },
      }),
    ]);
    if (!request || request.communityId !== input.communityId) {
      throw new CommunityError("Access request not found.", 404);
    }
    if (!canManageCommunity(input.actor, actorMembership?.role)) {
      throw new CommunityError("Community staff permission required.", 403);
    }
    if (request.status !== "PENDING") {
      throw new CommunityError("Access request is already resolved.", 409);
    }
    if (input.status === "APPROVED") {
      await tx.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: request.communityId,
            userId: request.userId,
          },
        },
        create: {
          communityId: request.communityId,
          userId: request.userId,
        },
        update: {},
      });
    }
    const updated = await tx.communityAccessRequest.update({
      where: { id: request.id },
      data: {
        status: input.status,
        resolution: input.resolution,
        resolvedById: input.actor.id,
        resolvedAt: new Date(),
      },
      select: { id: true, status: true },
    });
    await enqueueNotificationJobWithClient(tx, {
      recipientId: request.userId,
      actorId: input.actor.id,
      type: "COMMUNITY_ANNOUNCEMENT",
      templateKey: "ADMIN_ANNOUNCEMENT",
      data: {
        title:
          input.status === "APPROVED"
            ? `Welcome to ${request.community.name}`
            : `Request update from ${request.community.name}`,
        body:
          input.resolution ||
          (input.status === "APPROVED"
            ? "Your community access was approved."
            : "Your community access request was not approved."),
      },
      href: `/communities/${request.community.slug}`,
      dedupeKey: `community-access:${request.id}:${input.status}`,
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: `COMMUNITY_ACCESS_${input.status}`,
      entityType: "Community",
      entityId: request.communityId,
      newValue: { requestId: request.id, userId: request.userId },
      ...input.meta,
    });
    return { request: updated };
  });
}

export async function cancelCommunityAccessRequest(input: {
  actor: CommunityActor;
  communityId: string;
  requestId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.communityAccessRequest.findFirst({
      where: {
        id: input.requestId,
        communityId: input.communityId,
        userId: input.actor.id,
        status: "PENDING",
      },
      select: { id: true },
    });
    if (!request) throw new CommunityError("Access request not found.", 404);
    await tx.communityAccessRequest.update({
      where: { id: request.id },
      data: {
        status: "CANCELLED",
        resolvedById: input.actor.id,
        resolvedAt: new Date(),
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_ACCESS_CANCELLED",
      entityType: "Community",
      entityId: input.communityId,
      newValue: { requestId: request.id },
      ...input.meta,
    });
    return { cancelled: true };
  });
}

export async function createCommunityPost(input: {
  actor: CommunityActor;
  data: {
    communityId: string;
    type: PostType;
    title?: string;
    content: string;
    mediaIds: string[];
    eventAt?: Date;
    eventEndsAt?: Date;
    eventCapacity?: number;
    eventLocation?: string;
  };
  meta?: RequestMeta;
}) {
  const membership = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: input.data.communityId,
        userId: input.actor.id,
      },
    },
    select: {
      role: true,
      community: { select: { id: true, slug: true, status: true } },
    },
  });
  if (!membership || membership.community.status !== "ACTIVE") {
    throw new CommunityError("Join an active community before posting.", 403);
  }
  if (input.data.type === "ANNOUNCEMENT" && !localStaff(membership.role)) {
    throw new CommunityError(
      "Only community staff can publish announcements.",
      403,
    );
  }
  if (input.data.type === "EVENT" && input.data.eventAt! <= new Date()) {
    throw new CommunityError("Event start time must be in the future.");
  }
  const eventValidated = input.data.type === "EVENT" && localStaff(membership.role);
  const status =
    input.data.type === "EVENT" && !eventValidated
      ? ("PENDING_REVIEW" as const)
      : ("PUBLISHED" as const);

  const result = await prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        communityId: input.data.communityId,
        authorId: input.actor.id,
        type: input.data.type,
        status,
        title: input.data.title,
        content: input.data.content,
        eventAt: input.data.type === "EVENT" ? input.data.eventAt : null,
        eventEndsAt:
          input.data.type === "EVENT" ? input.data.eventEndsAt : null,
        eventCapacity:
          input.data.type === "EVENT" ? input.data.eventCapacity : null,
        eventLocation:
          input.data.type === "EVENT" ? input.data.eventLocation : null,
        eventValidatedAt: eventValidated ? new Date() : null,
      },
      select: {
        id: true,
        communityId: true,
        authorId: true,
        type: true,
        status: true,
        title: true,
        content: true,
        eventAt: true,
        eventEndsAt: true,
        eventCapacity: true,
        eventLocation: true,
        eventValidatedAt: true,
        pinnedAt: true,
        editedAt: true,
        createdAt: true,
      },
    });
    if (input.data.mediaIds.length) {
      await attachPostMedia(tx, {
        actorId: input.actor.id,
        postId: post.id,
        mediaIds: input.data.mediaIds,
      });
    }
    if (post.type === "ANNOUNCEMENT") {
      const recipients = await tx.communityMember.findMany({
        where: {
          communityId: post.communityId,
          userId: { not: input.actor.id },
        },
        select: { userId: true },
      });
      for (const recipient of recipients) {
        await enqueueNotificationJobWithClient(tx, {
          recipientId: recipient.userId,
          actorId: input.actor.id,
          type: "COMMUNITY_ANNOUNCEMENT",
          templateKey: "ADMIN_ANNOUNCEMENT",
          data: {
            title: post.title ?? "Community announcement",
            body: post.content.slice(0, 280),
          },
          href: `/communities/${membership.community.slug}?post=${post.id}`,
          dedupeKey: `community-announcement:${post.id}:${recipient.userId}`,
        });
      }
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "POST_CREATED",
      entityType: "Post",
      entityId: post.id,
      newValue: {
        communityId: post.communityId,
        type: post.type,
        status: post.status,
        mediaCount: input.data.mediaIds.length,
      },
      ...input.meta,
    });
    return {
      post: {
        ...post,
        createdAt: post.createdAt.toISOString(),
        eventAt: post.eventAt?.toISOString() ?? null,
        eventEndsAt: post.eventEndsAt?.toISOString() ?? null,
      },
    };
  });
  await trackEvent({
    name: "POST_CREATED",
    userId: input.actor.id,
    properties: {
      communityId: input.data.communityId,
      type: input.data.type,
    },
  });
  return result;
}

export async function updateCommunityPost(input: {
  actor: CommunityActor;
  postId: string;
  data: {
    type?: PostType;
    title?: string;
    content?: string;
    mediaIds?: string[];
    eventAt?: Date;
    eventEndsAt?: Date;
    eventCapacity?: number;
    eventLocation?: string;
  };
  meta?: RequestMeta;
}) {
  const post = await prisma.post.findUnique({
    where: { id: input.postId },
    select: {
      id: true,
      authorId: true,
      type: true,
      status: true,
      title: true,
      content: true,
      eventAt: true,
      eventEndsAt: true,
      eventCapacity: true,
      eventLocation: true,
      communityId: true,
      community: {
        select: {
          members: {
            where: { userId: input.actor.id },
            select: { role: true },
          },
        },
      },
    },
  });
  if (!post || post.status === "REMOVED") {
    throw new CommunityError("Post not found.", 404);
  }
  const globalManage = hasAdminPermission(
    input.actor.role,
    "COMMUNITY_CMS_MANAGE",
  );
  if (post.authorId !== input.actor.id && !globalManage) {
    throw new CommunityError("Only the author can edit this post.", 403);
  }
  const nextType = input.data.type ?? post.type;
  const nextEventAt = input.data.eventAt ?? post.eventAt ?? undefined;
  const nextEventEndsAt =
    input.data.eventEndsAt ?? post.eventEndsAt ?? undefined;
  if (nextType === "EVENT") {
    if (!nextEventAt || nextEventAt <= new Date()) {
      throw new CommunityError("Event start time must be in the future.");
    }
    if (nextEventEndsAt && nextEventEndsAt < nextEventAt) {
      throw new CommunityError("Event end time must follow its start time.");
    }
  }
  const authorStaff = localStaff(post.community.members[0]?.role);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.post.update({
      where: { id: post.id },
      data: {
        type: input.data.type,
        title: input.data.title,
        content: input.data.content,
        eventAt: nextType === "EVENT" ? nextEventAt : null,
        eventEndsAt: nextType === "EVENT" ? nextEventEndsAt : null,
        eventCapacity:
          nextType === "EVENT"
            ? (input.data.eventCapacity ?? post.eventCapacity)
            : null,
        eventLocation:
          nextType === "EVENT"
            ? (input.data.eventLocation ?? post.eventLocation)
            : null,
        editedAt: new Date(),
        ...(nextType === "EVENT" && !authorStaff && !globalManage
          ? { status: "PENDING_REVIEW", eventValidatedAt: null }
          : {}),
      },
      select: {
        id: true,
        status: true,
        type: true,
        title: true,
        content: true,
        editedAt: true,
      },
    });
    if (input.data.mediaIds) {
      await attachPostMedia(tx, {
        actorId: input.actor.id,
        postId: post.id,
        mediaIds: input.data.mediaIds,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "POST_UPDATED",
      entityType: "Post",
      entityId: post.id,
      newValue: { changedFields: Object.keys(input.data) },
      ...input.meta,
    });
    return { post: updated };
  });
}

export async function removeCommunityPost(input: {
  actor: CommunityActor;
  postId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: input.postId },
      select: {
        id: true,
        authorId: true,
        status: true,
        community: {
          select: {
            members: {
              where: { userId: input.actor.id },
              select: { role: true },
            },
          },
        },
      },
    });
    if (!post) throw new CommunityError("Post not found.", 404);
    if (
      post.authorId !== input.actor.id &&
      !canManageCommunity(input.actor, post.community.members[0]?.role)
    ) {
      throw new CommunityError("Post removal permission required.", 403);
    }
    if (post.status !== "REMOVED") {
      await tx.post.update({
        where: { id: post.id },
        data: { status: "REMOVED", removedAt: new Date(), pinnedAt: null },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "POST_REMOVED",
        entityType: "Post",
        entityId: post.id,
        oldValue: { status: post.status },
        newValue: { status: "REMOVED" },
        ...input.meta,
      });
    }
    return { removed: true };
  });
}

export async function moderateCommunityPost(input: {
  actor: CommunityActor;
  postId: string;
  action:
    | "PIN"
    | "UNPIN"
    | "PUBLISH"
    | "VALIDATE_EVENT"
    | "REMOVE"
    | "RESTORE";
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: input.postId },
      select: {
        id: true,
        type: true,
        status: true,
        eventAt: true,
        eventValidatedAt: true,
        pinnedAt: true,
        authorId: true,
        community: {
          select: {
            name: true,
            slug: true,
            members: {
              where: { userId: input.actor.id },
              select: { role: true },
            },
          },
        },
      },
    });
    if (!post) throw new CommunityError("Post not found.", 404);
    if (!canManageCommunity(input.actor, post.community.members[0]?.role)) {
      throw new CommunityError("Community moderation permission required.", 403);
    }
    const now = new Date();
    let data: Prisma.PostUpdateInput;
    switch (input.action) {
      case "PIN":
        if (post.status !== "PUBLISHED") {
          throw new CommunityError("Only published posts can be pinned.", 409);
        }
        data = { pinnedAt: now };
        break;
      case "UNPIN":
        data = { pinnedAt: null };
        break;
      case "VALIDATE_EVENT":
        if (post.type !== "EVENT" || !post.eventAt || post.eventAt <= now) {
          throw new CommunityError("This event cannot be validated.", 409);
        }
        data = { status: "PUBLISHED", eventValidatedAt: now, removedAt: null };
        break;
      case "PUBLISH":
        if (post.type === "EVENT") {
          throw new CommunityError("Validate the event before publishing.", 409);
        }
        data = { status: "PUBLISHED", removedAt: null };
        break;
      case "REMOVE":
        data = { status: "REMOVED", removedAt: now, pinnedAt: null };
        break;
      case "RESTORE":
        if (post.type === "EVENT" && !post.eventValidatedAt) {
          throw new CommunityError("Validate the event before restoring.", 409);
        }
        data = { status: "PUBLISHED", removedAt: null };
        break;
    }
    const updated = await tx.post.update({
      where: { id: post.id },
      data,
      select: {
        id: true,
        status: true,
        pinnedAt: true,
        eventValidatedAt: true,
      },
    });
    if (
      input.action === "VALIDATE_EVENT" &&
      post.authorId !== input.actor.id
    ) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: post.authorId,
        actorId: input.actor.id,
        type: "COMMUNITY_ANNOUNCEMENT",
        templateKey: "ADMIN_ANNOUNCEMENT",
        data: {
          title: `Event approved in ${post.community.name}`,
          body: "Your community event is now published.",
        },
        href: `/communities/${post.community.slug}?post=${post.id}`,
        dedupeKey: `community-event-approved:${post.id}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: `POST_${input.action}`,
      entityType: "Post",
      entityId: post.id,
      oldValue: {
        status: post.status,
        pinnedAt: post.pinnedAt,
        eventValidatedAt: post.eventValidatedAt,
      },
      newValue: updated,
      ...input.meta,
    });
    return { post: updated };
  });
}

export async function createPostComment(input: {
  actor: CommunityActor;
  postId: string;
  content: string;
  parentId?: string;
  meta?: RequestMeta;
}) {
  const post = await prisma.post.findFirst({
    where: {
      id: input.postId,
      ...publishedPostVisibilityWhere(input.actor, {
        moderatorOverride: true,
      }),
    },
    select: {
      id: true,
      authorId: true,
      communityId: true,
      community: {
        select: {
          slug: true,
          members: {
            where: { userId: input.actor.id },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!post) throw new CommunityError("Post not found.", 404);
  if (!post.community.members.length) {
    throw new CommunityError("Join this community before commenting.", 403);
  }
  const [actor, parent] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.actor.id },
      select: { firstName: true, lastName: true },
    }),
    input.parentId
      ? prisma.comment.findFirst({
          where: {
            id: input.parentId,
            postId: post.id,
            status: "PUBLISHED",
          },
          select: { id: true, authorId: true },
        })
      : null,
  ]);
  if (!actor) throw new CommunityError("User not found.", 404);
  if (input.parentId && !parent) {
    throw new CommunityError("Parent comment not found.", 404);
  }
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: {
        postId: post.id,
        authorId: input.actor.id,
        parentId: parent?.id,
        content: input.content,
      },
      select: {
        id: true,
        postId: true,
        authorId: true,
        parentId: true,
        content: true,
        status: true,
        createdAt: true,
      },
    });
    const recipients = new Set(
      [post.authorId, parent?.authorId].filter(
        (id): id is string => Boolean(id && id !== input.actor.id),
      ),
    );
    for (const recipientId of recipients) {
      await enqueuePostCommentNotification(tx, {
        recipientId,
        actorId: input.actor.id,
        actorName: `${actor.firstName} ${actor.lastName}`,
        commentId: comment.id,
        preview: comment.content,
        postHref: `/communities/${post.community.slug}?post=${post.id}#comments`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMENT_CREATED",
      entityType: "Comment",
      entityId: comment.id,
      newValue: {
        postId: post.id,
        parentId: comment.parentId,
      },
      ...input.meta,
    });
    return {
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  });
}

export async function updatePostComment(input: {
  actor: CommunityActor;
  commentId: string;
  content: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: input.commentId },
      select: { id: true, authorId: true, status: true, content: true },
    });
    if (!comment || comment.status !== "PUBLISHED") {
      throw new CommunityError("Comment not found.", 404);
    }
    if (comment.authorId !== input.actor.id) {
      throw new CommunityError("Only the author can edit this comment.", 403);
    }
    const updated = await tx.comment.update({
      where: { id: comment.id },
      data: { content: input.content, editedAt: new Date() },
      select: { id: true, content: true, editedAt: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMENT_UPDATED",
      entityType: "Comment",
      entityId: comment.id,
      newValue: { edited: true },
      ...input.meta,
    });
    return { comment: updated };
  });
}

export async function removePostComment(input: {
  actor: CommunityActor;
  commentId: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.findUnique({
      where: { id: input.commentId },
      select: {
        id: true,
        authorId: true,
        status: true,
        post: {
          select: {
            community: {
              select: {
                members: {
                  where: { userId: input.actor.id },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });
    if (!comment) throw new CommunityError("Comment not found.", 404);
    if (
      comment.authorId !== input.actor.id &&
      !canManageCommunity(
        input.actor,
        comment.post.community.members[0]?.role,
      )
    ) {
      throw new CommunityError("Comment removal permission required.", 403);
    }
    if (comment.status !== "REMOVED") {
      await tx.comment.update({
        where: { id: comment.id },
        data: { status: "REMOVED", removedAt: new Date() },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "COMMENT_REMOVED",
        entityType: "Comment",
        entityId: comment.id,
        oldValue: { status: comment.status },
        newValue: { status: "REMOVED" },
        ...input.meta,
      });
    }
    return { removed: true };
  });
}

export async function setCommentReaction(input: {
  actor: CommunityActor;
  commentId: string;
  type: ReactionType;
  reacted: boolean;
}) {
  const comment = await prisma.comment.findFirst({
    where: {
      id: input.commentId,
      status: "PUBLISHED",
      post: publishedPostVisibilityWhere(input.actor, {
        moderatorOverride: true,
      }),
    },
    select: { id: true },
  });
  if (!comment) throw new CommunityError("Comment not found.", 404);
  if (!input.reacted) {
    await prisma.reaction.deleteMany({
      where: {
        userId: input.actor.id,
        commentId: comment.id,
        type: input.type,
      },
    });
    return { reacted: false, type: input.type };
  }
  await prisma.reaction.upsert({
    where: {
      userId_commentId_type: {
        userId: input.actor.id,
        commentId: comment.id,
        type: input.type,
      },
    },
    create: {
      userId: input.actor.id,
      commentId: comment.id,
      type: input.type,
    },
    update: {},
  });
  return { reacted: true, type: input.type };
}

export async function createOrReuseCommunityContentReport(input: {
  actor: CommunityActor;
  targetType: "Community" | "Post" | "Comment";
  targetId: string;
  reason: ReportReason;
  details?: string;
  meta?: RequestMeta;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: input.targetType,
          targetId: input.targetId,
          status: { in: [...ACTIVE_REPORT_STATUSES] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };

      let subjectUserId: string | null = null;
      let mediaIds: string[] = [];
      let snapshot: Prisma.InputJsonObject;
      if (input.targetType === "Community") {
        const community = await tx.community.findFirst({
          where: {
            id: input.targetId,
            ...communityVisibilityWhere(input.actor),
          },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            isPrivate: true,
            ownerId: true,
            coverMediaId: true,
            createdAt: true,
            owner: {
              select: { firstName: true, lastName: true, username: true },
            },
          },
        });
        if (!community) throw new CommunityError("Community not found.", 404);
        subjectUserId = community.ownerId;
        mediaIds = community.coverMediaId ? [community.coverMediaId] : [];
        snapshot = {
          version: 1,
          targetType: "Community",
          targetId: community.id,
          communityId: community.id,
          communityName: community.name,
          authorId: community.ownerId,
          authorName: `${community.owner.firstName} ${community.owner.lastName}`,
          authorUsername: community.owner.username,
          title: community.name,
          body: community.description,
          status: community.status,
          isPrivate: community.isPrivate,
          mediaIds,
          createdAt: community.createdAt.toISOString(),
        };
      } else if (input.targetType === "Post") {
        const post = await tx.post.findFirst({
          where: {
            id: input.targetId,
            ...publishedPostVisibilityWhere(input.actor),
          },
          select: {
            id: true,
            communityId: true,
            authorId: true,
            type: true,
            title: true,
            content: true,
            status: true,
            createdAt: true,
            community: { select: { name: true } },
            author: {
              select: { firstName: true, lastName: true, username: true },
            },
            media: { select: { mediaId: true } },
          },
        });
        if (!post) throw new CommunityError("Post not found.", 404);
        subjectUserId = post.authorId;
        mediaIds = post.media.map(({ mediaId }) => mediaId);
        snapshot = {
          version: 1,
          targetType: "Post",
          targetId: post.id,
          communityId: post.communityId,
          communityName: post.community.name,
          authorId: post.authorId,
          authorName: `${post.author.firstName} ${post.author.lastName}`,
          authorUsername: post.author.username,
          title: post.title,
          body: post.content,
          status: post.status,
          postType: post.type,
          mediaIds,
          createdAt: post.createdAt.toISOString(),
        };
      } else {
        const comment = await tx.comment.findFirst({
          where: {
            id: input.targetId,
            status: "PUBLISHED",
            post: publishedPostVisibilityWhere(input.actor),
          },
          select: {
            id: true,
            postId: true,
            authorId: true,
            content: true,
            status: true,
            createdAt: true,
            post: {
              select: {
                communityId: true,
                community: { select: { name: true } },
              },
            },
            author: {
              select: { firstName: true, lastName: true, username: true },
            },
          },
        });
        if (!comment) throw new CommunityError("Comment not found.", 404);
        subjectUserId = comment.authorId;
        snapshot = {
          version: 1,
          targetType: "Comment",
          targetId: comment.id,
          communityId: comment.post.communityId,
          communityName: comment.post.community.name,
          postId: comment.postId,
          authorId: comment.authorId,
          authorName: `${comment.author.firstName} ${comment.author.lastName}`,
          authorUsername: comment.author.username,
          title: null,
          body: comment.content,
          status: comment.status,
          mediaIds: [],
          createdAt: comment.createdAt.toISOString(),
        };
      }

      const report = await tx.report.create({
        data: {
          reporterId: input.actor.id,
          subjectUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          details: input.details,
        },
        select: { id: true },
      });
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "COMMUNITY_CONTENT_SNAPSHOT",
          label: `${input.targetType} at time of report`,
          snapshot,
          capturedById: input.actor.id,
        },
      });
      if (mediaIds.length) {
        await tx.mediaAsset.updateMany({
          where: {
            id: { in: mediaIds },
            scanStatus: "CLEAN",
          },
          data: {
            retainedAt: new Date(),
            retentionReason: `Community content evidence for report ${report.id}`,
            storageDeletePending: false,
          },
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: input.targetType,
          targetId: input.targetId,
          reason: input.reason,
          subjectUserId,
        },
        ...input.meta,
      });
      return { reportId: report.id, reused: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: input.targetType,
          targetId: input.targetId,
          status: { in: [...ACTIVE_REPORT_STATUSES] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}

export async function listAdminCommunities(
  actor: CommunityActor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: CommunityStatus;
    type?: CommunityType;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "COMMUNITY_CMS_VIEW")) {
    throw new CommunityError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const query = input.query?.trim();
  const where: Prisma.CommunityWhereInput = {
    status: input.status,
    type: input.type,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, communities] = await Promise.all([
    prisma.community.count({ where }),
    prisma.community.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        status: true,
        joinPolicy: true,
        isPrivate: true,
        isVerified: true,
        updatedAt: true,
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: {
            members: true,
            posts: true,
            accessRequests: { where: { status: "PENDING" } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: communities.map((community) => ({
      ...community,
      owner: {
        id: community.owner.id,
        fullName: `${community.owner.firstName} ${community.owner.lastName}`,
      },
      updatedAt: community.updatedAt.toISOString(),
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminCommunity(
  actor: CommunityActor,
  communityId: string,
) {
  if (!hasAdminPermission(actor.role, "COMMUNITY_CMS_VIEW")) {
    throw new CommunityError("Access denied.", 403);
  }
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      type: true,
      status: true,
      joinPolicy: true,
      icon: true,
      coverMediaId: true,
      isVerified: true,
      isPrivate: true,
      createdAt: true,
      updatedAt: true,
      owner: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      members: {
        select: {
          id: true,
          role: true,
          joinedAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [{ role: "desc" }, { joinedAt: "asc" }],
        take: 100,
      },
      accessRequests: {
        where: { status: "PENDING" },
        select: {
          id: true,
          type: true,
          status: true,
          note: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      },
      posts: {
        select: {
          id: true,
          type: true,
          status: true,
          title: true,
          content: true,
          eventAt: true,
          eventValidatedAt: true,
          pinnedAt: true,
          createdAt: true,
          author: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: { select: { comments: true, reactions: true } },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      },
    },
  });
  if (!community) return null;
  return {
    ...community,
    coverUrl: community.coverMediaId
      ? `/api/media/${community.coverMediaId}`
      : null,
    owner: {
      ...community.owner,
      fullName: `${community.owner.firstName} ${community.owner.lastName}`,
    },
    members: community.members.map((member) => ({
      ...member,
      joinedAt: member.joinedAt.toISOString(),
      user: {
        ...member.user,
        fullName: `${member.user.firstName} ${member.user.lastName}`,
      },
    })),
    accessRequests: community.accessRequests.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
      user: {
        ...request.user,
        fullName: `${request.user.firstName} ${request.user.lastName}`,
      },
    })),
    posts: community.posts.map((post) => ({
      ...post,
      createdAt: post.createdAt.toISOString(),
      eventAt: post.eventAt?.toISOString() ?? null,
      eventValidatedAt: post.eventValidatedAt?.toISOString() ?? null,
      pinnedAt: post.pinnedAt?.toISOString() ?? null,
      author: {
        ...post.author,
        fullName: `${post.author.firstName} ${post.author.lastName}`,
      },
    })),
    createdAt: community.createdAt.toISOString(),
    updatedAt: community.updatedAt.toISOString(),
  };
}

export async function updateCommunityAsAdmin(input: {
  actor: CommunityActor;
  communityId: string;
  status?: CommunityStatus;
  isVerified?: boolean;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "COMMUNITY_CMS_MANAGE")) {
    throw new CommunityError("Access denied.", 403);
  }
  if (input.status === undefined && input.isVerified === undefined) {
    throw new CommunityError("No community changes were provided.");
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.community.findUnique({
      where: { id: input.communityId },
      select: { id: true, status: true, isVerified: true },
    });
    if (!current) throw new CommunityError("Community not found.", 404);
    const updated = await tx.community.update({
      where: { id: current.id },
      data: {
        status: input.status,
        isVerified: input.isVerified,
        moderatedAt: new Date(),
        removedAt:
          input.status === "REMOVED"
            ? new Date()
            : input.status
              ? null
              : undefined,
      },
      select: { id: true, status: true, isVerified: true, updatedAt: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "COMMUNITY_ADMIN_UPDATED",
      entityType: "Community",
      entityId: current.id,
      oldValue: current,
      newValue: updated,
      ...input.meta,
    });
    return {
      community: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  });
}
