import {
  Prisma,
  type AccountRequestStatus,
  type AccountRequestType,
  type ProfileAudience,
  type ReportReason,
  type ReportStatus,
  type Role,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedPostVisibilityWhere,
  publishedQuestionWhere,
} from "@/lib/content-visibility";
import { attachMediaAsset, finalizeMediaStorageDeletion } from "@/lib/media";
import { prisma } from "@/lib/prisma";

type ProfileActor = {
  id: string;
  role: AppRole | string;
};

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  username?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatarMediaId?: string | null;
  profileAudience?: ProfileAudience;
  locationAudience?: ProfileAudience;
  educationAudience?: ProfileAudience;
  languagesAudience?: ProfileAudience;
  communitiesAudience?: ProfileAudience;
  activityAudience?: ProfileAudience;
  marketplaceAudience?: ProfileAudience;
};

const ACTIVE_REQUEST_STATUSES: AccountRequestStatus[] = [
  "PENDING",
  "PROCESSING",
];
const ACTIVE_REPORT_STATUSES: ReportStatus[] = ["OPEN", "REVIEWING"];

export class ProfileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ProfileError";
  }
}

export function audienceAllows(
  audience: ProfileAudience,
  ownerId: string,
  viewer: ProfileActor | null,
) {
  if (viewer?.id === ownerId) return true;
  if (viewer && hasAdminPermission(viewer.role, "USER_VIEW")) return true;
  if (audience === "PUBLIC") return true;
  return audience === "MEMBERS" && Boolean(viewer);
}

function publicCommunityWhere(viewer: ProfileActor | null) {
  return viewer ? communityVisibilityWhere(viewer) : { isPrivate: false };
}

function publicPostWhere(viewer: ProfileActor | null) {
  return viewer
    ? publishedPostVisibilityWhere(viewer)
    : { status: "PUBLISHED" as const, community: { isPrivate: false } };
}

const profileBaseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  bio: true,
  status: true,
  profileAudience: true,
  locationAudience: true,
  educationAudience: true,
  languagesAudience: true,
  communitiesAudience: true,
  activityAudience: true,
  marketplaceAudience: true,
  degree: true,
  studyLevel: true,
  languages: true,
  createdAt: true,
  country: { select: { code: true, name: true, emoji: true } },
  city: { select: { slug: true, name: true } },
  university: {
    select: { slug: true, name: true, shortName: true },
  },
  avatarMedia: {
    select: {
      id: true,
      altText: true,
      status: true,
      scanStatus: true,
      width: true,
      height: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function getPublicProfile(
  identifier: string,
  viewer: ProfileActor | null,
) {
  const user = await prisma.user.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ username: identifier }, { id: identifier }],
    },
    select: profileBaseSelect,
  });
  if (!user || !audienceAllows(user.profileAudience, user.id, viewer)) {
    throw new ProfileError("Profile not found.", 404);
  }

  const communitiesVisible = audienceAllows(
    user.communitiesAudience,
    user.id,
    viewer,
  );
  const activityVisible = audienceAllows(
    user.activityAudience,
    user.id,
    viewer,
  );
  const marketplaceVisible = audienceAllows(
    user.marketplaceAudience,
    user.id,
    viewer,
  );
  const communityWhere = publicCommunityWhere(viewer);
  const postWhere = publicPostWhere(viewer);

  const [
    communities,
    communityCount,
    posts,
    postCount,
    listings,
    listingCount,
    questions,
    questionCount,
    blocks,
  ] = await Promise.all([
    communitiesVisible
      ? prisma.communityMember.findMany({
          where: { userId: user.id, community: communityWhere },
          select: {
            joinedAt: true,
            community: {
              select: {
                id: true,
                slug: true,
                name: true,
                icon: true,
                isVerified: true,
              },
            },
          },
          orderBy: { joinedAt: "desc" },
          take: 8,
        })
      : [],
    communitiesVisible
      ? prisma.communityMember.count({
          where: { userId: user.id, community: communityWhere },
        })
      : null,
    activityVisible
      ? prisma.post.findMany({
          where: { authorId: user.id, ...postWhere },
          select: {
            id: true,
            title: true,
            content: true,
            createdAt: true,
            community: {
              select: { slug: true, name: true, icon: true },
            },
            _count: {
              select: {
                comments: { where: { status: "PUBLISHED" } },
                reactions: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    activityVisible
      ? prisma.post.count({ where: { authorId: user.id, ...postWhere } })
      : null,
    marketplaceVisible
      ? prisma.marketplaceListing.findMany({
          where: { sellerId: user.id, ...activeListingWhere() },
          select: {
            id: true,
            slug: true,
            title: true,
            priceFen: true,
            createdAt: true,
            city: { select: { name: true } },
            category: { select: { name: true, icon: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    marketplaceVisible
      ? prisma.marketplaceListing.count({
          where: { sellerId: user.id, ...activeListingWhere() },
        })
      : null,
    activityVisible
      ? prisma.question.findMany({
          where: { authorId: user.id, ...publishedQuestionWhere },
          select: {
            id: true,
            slug: true,
            title: true,
            category: true,
            createdAt: true,
            _count: {
              select: { answers: { where: { status: "PUBLISHED" } } },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : [],
    activityVisible
      ? prisma.question.count({
          where: { authorId: user.id, ...publishedQuestionWhere },
        })
      : null,
    viewer && viewer.id !== user.id
      ? prisma.userBlock.findMany({
          where: {
            OR: [
              { blockerId: viewer.id, blockedId: user.id },
              { blockerId: user.id, blockedId: viewer.id },
            ],
          },
          select: { blockerId: true, blockedId: true },
        })
      : [],
  ]);

  const activity = [
    ...posts.map((post) => ({
      type: "POST" as const,
      id: post.id,
      title: post.title ?? post.content.slice(0, 100),
      subtitle: `${post.community.icon ?? "💬"} ${post.community.name} · ${post._count.reactions} reactions · ${post._count.comments} comments`,
      href: `/communities/${post.community.slug}`,
      createdAt: post.createdAt.toISOString(),
    })),
    ...questions.map((question) => ({
      type: "QUESTION" as const,
      id: question.id,
      title: question.title,
      subtitle: `${question.category} · ${question._count.answers} answers`,
      href: `/help/${question.slug}`,
      createdAt: question.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 10);

  const blockedByViewer = blocks.some(
    (block) => block.blockerId === viewer?.id,
  );
  const blockedEitherDirection = blocks.length > 0;
  const isOwner = viewer?.id === user.id;

  return {
    version: 1 as const,
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: `${user.firstName} ${user.lastName}`,
    bio: user.bio,
    avatar:
      user.avatarMedia?.status === "ACTIVE" &&
      user.avatarMedia.scanStatus === "CLEAN"
        ? {
            id: user.avatarMedia.id,
            url: `/api/media/${user.avatarMedia.id}`,
            altText:
              user.avatarMedia.altText ??
              `Portrait of ${user.firstName} ${user.lastName}`,
            width: user.avatarMedia.width,
            height: user.avatarMedia.height,
          }
        : null,
    location: audienceAllows(user.locationAudience, user.id, viewer)
      ? {
          country: user.country,
          city: user.city,
        }
      : null,
    education: audienceAllows(user.educationAudience, user.id, viewer)
      ? {
          university: user.university,
          degree: user.degree,
          studyLevel: user.studyLevel,
        }
      : null,
    languages: audienceAllows(user.languagesAudience, user.id, viewer)
      ? user.languages
      : null,
    counts: {
      communities: communityCount,
      posts: postCount,
      listings: listingCount,
      questions: questionCount,
    },
    communities: communitiesVisible
      ? communities.map(({ community }) => community)
      : null,
    activity: activityVisible ? activity : null,
    marketplace: marketplaceVisible
      ? listings.map((listing) => ({
          ...listing,
          createdAt: listing.createdAt.toISOString(),
        }))
      : null,
    joinedAt: user.createdAt.toISOString(),
    viewer: {
      isOwner,
      blockedByViewer,
      canMessage: Boolean(viewer && !isOwner && !blockedEitherDirection),
      canReport: Boolean(viewer && !isOwner),
    },
  };
}

export async function getOwnProfileSettings(userId: string) {
  const [user, requests] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        bio: true,
        phone: true,
        avatarMediaId: true,
        profileAudience: true,
        locationAudience: true,
        educationAudience: true,
        languagesAudience: true,
        communitiesAudience: true,
        activityAudience: true,
        marketplaceAudience: true,
      },
    }),
    listOwnAccountRequests(userId),
  ]);
  return { ...user, accountRequests: requests };
}

export async function updateProfile(
  actor: ProfileActor,
  input: ProfileUpdate,
  meta: RequestMeta = {},
) {
  const hasAvatarField = Object.prototype.hasOwnProperty.call(
    input,
    "avatarMediaId",
  );
  let mediaToDelete: {
    id: string;
    objectKey: string;
    storageProvider: "LOCAL" | "S3";
  } | null = null;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: actor.id },
        select: {
          id: true,
          avatarMediaId: true,
          firstName: true,
          lastName: true,
          username: true,
          bio: true,
          phone: true,
          profileAudience: true,
          locationAudience: true,
          educationAudience: true,
          languagesAudience: true,
          communitiesAudience: true,
          activityAudience: true,
          marketplaceAudience: true,
        },
      });
      if (!current) throw new ProfileError("Profile not found.", 404);

      if (
        hasAvatarField &&
        input.avatarMediaId &&
        input.avatarMediaId !== current.avatarMediaId
      ) {
        const media = await tx.mediaAsset.findUnique({
          where: { id: input.avatarMediaId },
        });
        if (
          !media ||
          media.ownerId !== actor.id ||
          media.purpose !== "PROFILE_AVATAR" ||
          media.status !== "ACTIVE" ||
          media.scanStatus !== "CLEAN"
        ) {
          throw new ProfileError(
            "Validated profile avatar was not found.",
            400,
          );
        }
        if (
          current.avatarMediaId &&
          media.replacesId !== current.avatarMediaId
        ) {
          throw new ProfileError(
            "A new avatar must replace the current avatar.",
            409,
          );
        }
        await attachMediaAsset(tx, {
          ownerId: actor.id,
          assetId: media.id,
          purpose: "PROFILE_AVATAR",
          attachmentType: "USER_AVATAR",
          attachmentId: actor.id,
        });
      }

      if (
        hasAvatarField &&
        input.avatarMediaId === null &&
        current.avatarMediaId
      ) {
        const oldMedia = await tx.mediaAsset.findUnique({
          where: { id: current.avatarMediaId },
        });
        if (oldMedia && oldMedia.status !== "REMOVED") {
          if (oldMedia.status === "PROCESSING") {
            throw new ProfileError("Avatar is currently being processed.", 409);
          }
          const removed = await tx.mediaAsset.update({
            where: { id: oldMedia.id },
            data: {
              status: "REMOVED",
              removedAt: new Date(),
              removedById: actor.id,
              rejectionReason: "Removed from profile by owner.",
              storageDeletePending: true,
            },
          });
          mediaToDelete = {
            id: removed.id,
            objectKey: removed.objectKey,
            storageProvider: removed.storageProvider,
          };
          await writeAuditLogWithClient(tx, {
            actorId: actor.id,
            action: "MEDIA_REMOVED_BY_OWNER",
            entityType: "MediaAsset",
            entityId: removed.id,
            newValue: {
              status: removed.status,
              reason: "Removed from profile by owner.",
            },
            ...meta,
          });
        }
      }

      const data: Prisma.UserUpdateInput = {
        firstName: input.firstName,
        lastName: input.lastName,
        username: input.username,
        bio: input.bio,
        phone: input.phone,
        profileAudience: input.profileAudience,
        locationAudience: input.locationAudience,
        educationAudience: input.educationAudience,
        languagesAudience: input.languagesAudience,
        communitiesAudience: input.communitiesAudience,
        activityAudience: input.activityAudience,
        marketplaceAudience: input.marketplaceAudience,
        ...(hasAvatarField
          ? {
              avatarMedia: input.avatarMediaId
                ? { connect: { id: input.avatarMediaId } }
                : { disconnect: true },
            }
          : {}),
      };
      const updated = await tx.user.update({
        where: { id: actor.id },
        data,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          bio: true,
          phone: true,
          avatarMediaId: true,
          profileAudience: true,
          locationAudience: true,
          educationAudience: true,
          languagesAudience: true,
          communitiesAudience: true,
          activityAudience: true,
          marketplaceAudience: true,
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "PROFILE_UPDATED",
        entityType: "User",
        entityId: actor.id,
        newValue: {
          changedFields: Object.keys(input),
          avatarMediaId: updated.avatarMediaId,
        },
        ...meta,
      });
      return updated;
    });
    if (mediaToDelete) {
      await finalizeMediaStorageDeletion(mediaToDelete);
    }
    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ProfileError("That username is already in use.", 409);
    }
    throw error;
  }
}

export async function getSavedContent(userId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const grouped = {
    POST: bookmarks.filter(({ targetType }) => targetType === "POST"),
    LISTING: bookmarks.filter(({ targetType }) => targetType === "LISTING"),
    GUIDE: bookmarks.filter(({ targetType }) => targetType === "GUIDE"),
    QUESTION: bookmarks.filter(({ targetType }) => targetType === "QUESTION"),
  };
  const [posts, listings, guides, questions] = await Promise.all([
    prisma.post.findMany({
      where: {
        id: { in: grouped.POST.map(({ targetId }) => targetId) },
        ...publishedPostVisibilityWhere({ id: userId }),
      },
      select: {
        id: true,
        title: true,
        content: true,
        community: { select: { slug: true, name: true } },
      },
    }),
    prisma.marketplaceListing.findMany({
      where: {
        id: { in: grouped.LISTING.map(({ targetId }) => targetId) },
        ...activeListingWhere(),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        city: { select: { name: true } },
      },
    }),
    prisma.guide.findMany({
      where: {
        id: { in: grouped.GUIDE.map(({ targetId }) => targetId) },
        published: true,
      },
      select: { id: true, slug: true, title: true, category: true },
    }),
    prisma.question.findMany({
      where: {
        id: { in: grouped.QUESTION.map(({ targetId }) => targetId) },
        ...publishedQuestionWhere,
      },
      select: { id: true, slug: true, title: true, category: true },
    }),
  ]);
  const items = new Map<
    string,
    { type: string; title: string; subtitle: string; href: string }
  >();
  for (const post of posts) {
    items.set(`POST:${post.id}`, {
      type: "POST",
      title: post.title ?? post.content.slice(0, 100),
      subtitle: post.community.name,
      href: `/communities/${post.community.slug}`,
    });
  }
  for (const listing of listings) {
    items.set(`LISTING:${listing.id}`, {
      type: "LISTING",
      title: listing.title,
      subtitle: listing.city.name,
      href: `/marketplace/${listing.slug}`,
    });
  }
  for (const guide of guides) {
    items.set(`GUIDE:${guide.id}`, {
      type: "GUIDE",
      title: guide.title,
      subtitle: guide.category,
      href: `/guides/${guide.slug}`,
    });
  }
  for (const question of questions) {
    items.set(`QUESTION:${question.id}`, {
      type: "QUESTION",
      title: question.title,
      subtitle: question.category,
      href: `/help/${question.slug}`,
    });
  }
  return bookmarks.flatMap((bookmark) => {
    const item = items.get(`${bookmark.targetType}:${bookmark.targetId}`);
    return item ? [{ ...item, savedAt: bookmark.createdAt.toISOString() }] : [];
  });
}

export async function createOrReuseProfileReport(input: {
  reporter: ProfileActor;
  subjectUserId: string;
  reason: ReportReason;
  details?: string;
  meta?: RequestMeta;
}) {
  if (input.reporter.id === input.subjectUserId) {
    throw new ProfileError("You cannot report your own profile.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const subject = await tx.user.findFirst({
        where: { id: input.subjectUserId, status: "ACTIVE" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          bio: true,
          avatarMediaId: true,
          profileAudience: true,
          createdAt: true,
        },
      });
      if (!subject) throw new ProfileError("Profile not found.", 404);
      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.reporter.id,
          targetType: "UserProfile",
          targetId: subject.id,
          status: { in: ACTIVE_REPORT_STATUSES },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
      const report = await tx.report.create({
        data: {
          reporterId: input.reporter.id,
          subjectUserId: subject.id,
          targetType: "UserProfile",
          targetId: subject.id,
          reason: input.reason,
          details: input.details,
        },
        select: { id: true },
      });
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "PROFILE_SNAPSHOT",
          label: "Profile at time of report",
          snapshot: {
            version: 1,
            subjectUserId: subject.id,
            firstName: subject.firstName,
            lastName: subject.lastName,
            username: subject.username,
            bio: subject.bio,
            avatarMediaId: subject.avatarMediaId,
            profileAudience: subject.profileAudience,
            profileCreatedAt: subject.createdAt.toISOString(),
          },
          capturedById: input.reporter.id,
        },
      });
      if (subject.avatarMediaId) {
        await tx.mediaAsset.updateMany({
          where: {
            id: subject.avatarMediaId,
            ownerId: subject.id,
            scanStatus: "CLEAN",
          },
          data: {
            retainedAt: new Date(),
            retentionReason: `Profile moderation evidence for report ${report.id}`,
            storageDeletePending: false,
          },
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: input.reporter.id,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: "UserProfile",
          targetId: subject.id,
          reason: input.reason,
          subjectUserId: subject.id,
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
          reporterId: input.reporter.id,
          targetType: "UserProfile",
          targetId: input.subjectUserId,
          status: { in: ACTIVE_REPORT_STATUSES },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}

function accountRequestDto(request: {
  id: string;
  type: AccountRequestType;
  status: AccountRequestStatus;
  reason: string | null;
  responseNote: string | null;
  version: number;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...request,
    processedAt: request.processedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}

export async function listOwnAccountRequests(userId: string) {
  const requests = await prisma.accountRequest.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      status: true,
      reason: true,
      responseNote: true,
      version: true,
      processedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return requests.map(accountRequestDto);
}

export async function createAccountRequest(
  actor: ProfileActor,
  input: { type: AccountRequestType; reason?: string },
  meta: RequestMeta = {},
) {
  try {
    const request = await prisma.$transaction(async (tx) => {
      const existing = await tx.accountRequest.findFirst({
        where: {
          userId: actor.id,
          type: input.type,
          status: { in: ACTIVE_REQUEST_STATUSES },
        },
      });
      if (existing) return existing;
      const created = await tx.accountRequest.create({
        data: {
          userId: actor.id,
          type: input.type,
          reason: input.reason,
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "ACCOUNT_REQUEST_CREATED",
        entityType: "AccountRequest",
        entityId: created.id,
        newValue: { type: created.type, status: created.status },
        ...meta,
      });
      return created;
    });
    return accountRequestDto(request);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.accountRequest.findFirst({
        where: {
          userId: actor.id,
          type: input.type,
          status: { in: ACTIVE_REQUEST_STATUSES },
        },
      });
      if (existing) return accountRequestDto(existing);
    }
    throw error;
  }
}

export async function cancelAccountRequest(
  actor: ProfileActor,
  requestId: string,
  expectedVersion: number,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.accountRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing || existing.userId !== actor.id) {
      throw new ProfileError("Account request not found.", 404);
    }
    const result = await tx.accountRequest.updateMany({
      where: {
        id: requestId,
        userId: actor.id,
        status: "PENDING",
        version: expectedVersion,
      },
      data: { status: "CANCELLED", version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new ProfileError(
        existing.status === "PENDING"
          ? "Account request changed. Refresh and try again."
          : "Only pending requests can be cancelled.",
        409,
      );
    }
    const cancelled = await tx.accountRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "ACCOUNT_REQUEST_CANCELLED",
      entityType: "AccountRequest",
      entityId: requestId,
      oldValue: { status: existing.status, version: existing.version },
      newValue: { status: cancelled.status, version: cancelled.version },
      ...meta,
    });
    return accountRequestDto(cancelled);
  });
}

export async function transitionAccountRequest(
  actor: ProfileActor,
  input: {
    requestId: string;
    status: Exclude<AccountRequestStatus, "PENDING" | "CANCELLED">;
    expectedVersion: number;
    responseNote?: string;
  },
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "ACCOUNT_REQUEST_MANAGE")) {
    throw new ProfileError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.accountRequest.findUnique({
      where: { id: input.requestId },
    });
    if (!existing) throw new ProfileError("Account request not found.", 404);
    const allowed =
      (existing.status === "PENDING" &&
        (input.status === "PROCESSING" || input.status === "REJECTED")) ||
      (existing.status === "PROCESSING" &&
        (input.status === "COMPLETED" || input.status === "REJECTED"));
    if (!allowed) {
      throw new ProfileError("Invalid account-request transition.", 409);
    }
    const result = await tx.accountRequest.updateMany({
      where: {
        id: input.requestId,
        status: existing.status,
        version: input.expectedVersion,
      },
      data: {
        status: input.status,
        responseNote: input.responseNote,
        processedById: actor.id,
        processedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new ProfileError(
        "Account request changed. Refresh and try again.",
        409,
      );
    }
    const updated = await tx.accountRequest.findUniqueOrThrow({
      where: { id: input.requestId },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "ACCOUNT_REQUEST_STATUS_UPDATED",
      entityType: "AccountRequest",
      entityId: updated.id,
      oldValue: { status: existing.status, version: existing.version },
      newValue: { status: updated.status, version: updated.version },
      ...meta,
    });
    return accountRequestDto(updated);
  });
}

export async function listAdminUsers(
  actor: ProfileActor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
    role?: Role;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "USER_VIEW")) {
    throw new ProfileError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25)));
  const query = input.query?.trim();
  const where: Prisma.UserWhereInput = {
    status: input.status,
    role: input.role,
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { firstName: { contains: query, mode: "insensitive" } },
            { lastName: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        status: true,
        profileAudience: true,
        avatarMediaId: true,
        createdAt: true,
        university: { select: { name: true } },
        _count: {
          select: {
            reports: true,
            reportedSubjects: true,
            accountRequests: {
              where: { status: { in: ACTIVE_REQUEST_STATUSES } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    users: users.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
      fullName: `${user.firstName} ${user.lastName}`,
      reportCount: user._count.reportedSubjects,
      activeRequestCount: user._count.accountRequests,
      _count: undefined,
    })),
  };
}

export async function getAdminUser(actor: ProfileActor, userId: string) {
  if (!hasAdminPermission(actor.role, "USER_VIEW")) {
    throw new ProfileError("Access denied.", 403);
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      firstName: true,
      lastName: true,
      username: true,
      bio: true,
      phone: true,
      role: true,
      status: true,
      avatarMediaId: true,
      profileAudience: true,
      locationAudience: true,
      educationAudience: true,
      languagesAudience: true,
      communitiesAudience: true,
      activityAudience: true,
      marketplaceAudience: true,
      degree: true,
      studyLevel: true,
      languages: true,
      interests: true,
      onboardingCompletedAt: true,
      lastActiveAt: true,
      createdAt: true,
      updatedAt: true,
      country: { select: { code: true, name: true } },
      city: { select: { slug: true, name: true } },
      university: { select: { slug: true, name: true } },
      accountRequests: {
        select: {
          id: true,
          type: true,
          status: true,
          reason: true,
          responseNote: true,
          version: true,
          processedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      reportedSubjects: {
        select: {
          id: true,
          reason: true,
          status: true,
          targetType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      posts: {
        where: {
          status: "PUBLISHED",
          community: { status: "ACTIVE", isPrivate: false },
        },
        select: {
          id: true,
          title: true,
          content: true,
          community: { select: { slug: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      marketplaceListings: {
        where: activeListingWhere(),
        select: { id: true, slug: true, title: true, status: true },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
      communityMemberships: {
        where: {
          community: { status: "ACTIVE", isPrivate: false },
        },
        select: {
          id: true,
          role: true,
          community: { select: { slug: true, name: true } },
        },
        orderBy: { joinedAt: "desc" },
        take: 5,
      },
      _count: {
        select: {
          communityMemberships: true,
          posts: true,
          marketplaceListings: true,
          questions: true,
          answers: true,
          sessions: true,
        },
      },
    },
  });
  if (!user) throw new ProfileError("User not found.", 404);
  return {
    ...user,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    fullName: `${user.firstName} ${user.lastName}`,
    accountRequests: user.accountRequests.map(accountRequestDto),
    reports: user.reportedSubjects.map((report) => ({
      ...report,
      createdAt: report.createdAt.toISOString(),
    })),
    reportedSubjects: undefined,
  };
}

export async function updateUserStatusAsAdmin(input: {
  actor: ProfileActor;
  userId: string;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  reason: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "USER_MANAGE")) {
    throw new ProfileError("Access denied.", 403);
  }
  if (input.actor.id === input.userId) {
    throw new ProfileError("You cannot change your own account status.", 409);
  }
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true, status: true },
    });
    if (!target) throw new ProfileError("Account not found.", 404);
    if (target.role === "SUPER_ADMIN" && input.actor.role !== "SUPER_ADMIN") {
      throw new ProfileError(
        "Only a Super Admin can change another Super Admin's status.",
        403,
      );
    }
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { status: input.status },
      select: { id: true, status: true },
    });
    let sessionsRevoked = 0;
    if (input.status !== "ACTIVE") {
      const revoked = await tx.session.deleteMany({
        where: { userId: target.id },
      });
      sessionsRevoked = revoked.count;
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "USER_STATUS_UPDATED",
      entityType: "User",
      entityId: target.id,
      oldValue: { status: target.status },
      newValue: {
        status: updated.status,
        reason: input.reason,
        sessionsRevoked,
      },
      ...input.meta,
    });
    return { status: updated.status, sessionsRevoked };
  });
}

export async function updateUserRoleAsAdmin(input: {
  actor: ProfileActor;
  userId: string;
  role: Role;
  reason: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "USER_ROLE_MANAGE")) {
    throw new ProfileError("Access denied.", 403);
  }
  if (input.actor.id === input.userId) {
    throw new ProfileError(
      "You cannot change your own administrator role.",
      409,
    );
  }

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true },
    });
    if (!target) throw new ProfileError("Account not found.", 404);
    if (target.role === input.role) {
      return { role: target.role, sessionsRevoked: 0 };
    }

    const updated = await tx.user.update({
      where: { id: target.id },
      data: { role: input.role },
      select: { role: true },
    });
    const revoked = await tx.session.deleteMany({
      where: { userId: target.id },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "USER_ROLE_UPDATED",
      entityType: "User",
      entityId: target.id,
      oldValue: { role: target.role },
      newValue: {
        role: updated.role,
        reason: input.reason,
        sessionsRevoked: revoked.count,
      },
      ...input.meta,
    });
    return { role: updated.role, sessionsRevoked: revoked.count };
  });
}

export async function revokeUserSessionsAsAdmin(input: {
  actor: ProfileActor;
  userId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "USER_MANAGE")) {
    throw new ProfileError("Access denied.", 403);
  }
  if (input.actor.id === input.userId) {
    throw new ProfileError("You cannot revoke your own sessions here.", 409);
  }
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, role: true },
    });
    if (!target) throw new ProfileError("Account not found.", 404);
    if (target.role === "SUPER_ADMIN" && input.actor.role !== "SUPER_ADMIN") {
      throw new ProfileError(
        "Only a Super Admin can revoke another Super Admin's sessions.",
        403,
      );
    }
    const revoked = await tx.session.deleteMany({
      where: { userId: target.id },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "USER_SESSIONS_REVOKED_BY_ADMIN",
      entityType: "User",
      entityId: target.id,
      newValue: { sessionsRevoked: revoked.count },
      ...input.meta,
    });
    return { sessionsRevoked: revoked.count };
  });
}
