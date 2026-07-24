import { randomUUID } from "node:crypto";
import {
  Prisma,
  type StoryCreatorStatus,
  type StoryStatus,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { toSafePublicOfficialFields } from "@/lib/serializers";
import type {
  storyAdminTransitionSchema,
  storyCategorySchema,
  storyCategoryUpdateSchema,
  storyCommentSchema,
  storyCreatorStatusSchema,
  storyInteractionSchema,
  storyReportSchema,
  storyRevisionSchema,
  storySubmissionSchema,
} from "@/lib/story-validation";
import type { z } from "zod";

export type StoryActor = {
  id: string;
  role: AppRole | string;
  cityId?: string | null;
  universityId?: string | null;
  languages?: string[];
  interests?: string[];
  storyCreatorStatus?: StoryCreatorStatus;
  officialProfileStatus?: string;
};

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type StorySubmission = z.infer<typeof storySubmissionSchema>;
type StoryRevision = z.infer<typeof storyRevisionSchema>;
type StoryInteraction = z.infer<typeof storyInteractionSchema>;
type StoryCommentInput = z.infer<typeof storyCommentSchema>;
type StoryReportInput = z.infer<typeof storyReportSchema>;
type StoryTransitionInput = z.infer<typeof storyAdminTransitionSchema>;
type StoryCategoryInput = z.infer<typeof storyCategorySchema>;
type StoryCategoryUpdate = z.infer<typeof storyCategoryUpdateSchema>;
type StoryCreatorStatusInput = z.infer<typeof storyCreatorStatusSchema>;

export class StoryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "StoryError";
  }
}

const storyFeedInclude = (userId: string) =>
  ({
    category: {
      select: { id: true, slug: true, name: true, icon: true },
    },
    creator: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        avatarMediaId: true,
        storyCreatorStatus: true,
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
      },
    },
    entityLinks: {
      include: {
        city: { select: { id: true, slug: true, name: true } },
        university: {
          select: { id: true, slug: true, name: true, shortName: true },
        },
        community: {
          select: { id: true, slug: true, name: true, icon: true },
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
    likes: { where: { userId }, select: { userId: true } },
    saves: { where: { userId }, select: { userId: true } },
    _count: { select: { likes: true, saves: true, comments: true } },
  }) satisfies Prisma.StoryInclude;

type StoryFeedRecord = Prisma.StoryGetPayload<{
  include: ReturnType<typeof storyFeedInclude>;
}>;

function storyHref(slug: string) {
  return `/stories?story=${encodeURIComponent(slug)}`;
}

function entityLinkDto(link: StoryFeedRecord["entityLinks"][number]) {
  if (link.city) {
    return {
      id: link.id,
      type: link.type,
      entityId: link.city.id,
      label: link.city.name,
      href: `/explore/${link.city.slug}`,
      actionLabel: "Explore this city",
    };
  }
  if (link.community) {
    return {
      id: link.id,
      type: link.type,
      entityId: link.community.id,
      label: link.community.name,
      href: `/communities/${link.community.slug}`,
      actionLabel: "Open this community",
    };
  }
  if (link.university) {
    return {
      id: link.id,
      type: link.type,
      entityId: link.university.id,
      label: link.university.shortName ?? link.university.name,
      href: null,
      actionLabel: "University context",
    };
  }
  return {
    id: link.id,
    type: link.type,
    entityId: link.externalEntityId,
    label: link.externalLabel ?? "Kondo resource",
    href: link.externalHref,
    actionLabel:
      link.type === "EVENT"
        ? "View the event"
        : link.type === "INTERNSHIP"
          ? "View the internship"
          : "Discover the organization",
  };
}

function recommendationReason(
  story: StoryFeedRecord,
  actor: StoryActor,
  communityIds: Set<string>,
) {
  if (
    actor.cityId &&
    story.entityLinks.some((link) => link.cityId === actor.cityId)
  ) {
    return "Because it concerns your city";
  }
  if (
    actor.universityId &&
    story.entityLinks.some((link) => link.universityId === actor.universityId)
  ) {
    return "Because it is connected to your university";
  }
  if (
    story.entityLinks.some(
      (link) => link.communityId && communityIds.has(link.communityId),
    )
  ) {
    return "From a community you joined";
  }
  if (story.isInstitutional) return "Important information for Kondo students";
  if (story.isFeatured) return "Selected for its practical value";
  return "A recent useful story";
}

function storyDto(
  story: StoryFeedRecord,
  actor: StoryActor,
  communityIds: Set<string>,
) {
  const links = story.entityLinks.map(entityLinkDto);
  const official = toSafePublicOfficialFields(story.creator);
  return {
    id: story.id,
    slug: story.slug,
    href: storyHref(story.slug),
    title: story.title,
    description: story.description,
    language: story.language,
    durationSeconds: story.durationSeconds,
    captions: Boolean(story.captions),
    videoUrl: `/api/media/${story.videoMediaId}`,
    videoMediaId: story.videoMediaId,
    posterMediaId: story.posterMediaId,
    posterUrl: story.posterMediaId ? `/api/media/${story.posterMediaId}` : null,
    category: story.category,
    creator: {
      id: story.creator.id,
      name: `${story.creator.firstName} ${story.creator.lastName}`,
      username: story.creator.username,
      avatarMediaId: story.creator.avatarMediaId,
      profileHref: `/profile/${story.creator.username ?? story.creator.id}`,
      trusted: story.creator.storyCreatorStatus === "TRUSTED_CREATOR",
      official: official.officialProfileStatus === "APPROVED",
      officialOrganizationType: official.officialOrganizationType,
      officialOrganizationName: official.officialOrganizationName,
      officialVerifiedAt: official.officialVerifiedAt?.toISOString() ?? null,
    },
    links,
    isInstitutional: story.isInstitutional,
    isSponsored: story.isSponsored,
    isFeatured: story.isFeatured,
    publishedAt: story.publishedAt?.toISOString() ?? null,
    recommendationReason: recommendationReason(story, actor, communityIds),
    counts: story._count,
    viewer: {
      liked: story.likes.length > 0,
      saved: story.saves.length > 0,
    },
  };
}

function visibleStoryWhere(actor: StoryActor): Prisma.StoryWhereInput {
  return {
    status: "PUBLISHED",
    publishedAt: { lte: new Date() },
    hiddenBy: { none: { userId: actor.id } },
    creator: {
      status: "ACTIVE",
      blockedUsers: { none: { blockedId: actor.id } },
      blockedByUsers: { none: { blockerId: actor.id } },
    },
  };
}

function scoreStory(
  story: StoryFeedRecord,
  actor: StoryActor,
  communityIds: Set<string>,
) {
  let score = story.qualityScore * 20;
  if (story.isFeatured) score += 26;
  if (story.isInstitutional) score += 18;
  if (
    actor.cityId &&
    story.entityLinks.some((link) => link.cityId === actor.cityId)
  ) {
    score += 30;
  }
  if (
    actor.universityId &&
    story.entityLinks.some((link) => link.universityId === actor.universityId)
  ) {
    score += 28;
  }
  if (
    story.entityLinks.some(
      (link) => link.communityId && communityIds.has(link.communityId),
    )
  ) {
    score += 22;
  }
  if (
    actor.languages?.some((language) =>
      story.language
        .toLowerCase()
        .startsWith(language.slice(0, 2).toLowerCase()),
    )
  ) {
    score += 8;
  }
  const ageDays = story.publishedAt
    ? Math.max(
        0,
        (Date.now() - story.publishedAt.getTime()) / (24 * 60 * 60 * 1000),
      )
    : 365;
  score += Math.max(0, 15 - ageDays / 2);
  score += Math.min(5, story._count.saves * 0.5);
  score += Math.min(3, story._count.likes * 0.1);
  return score;
}

function diversify(records: StoryFeedRecord[], limit: number) {
  const selected: StoryFeedRecord[] = [];
  const remaining = [...records];
  while (remaining.length && selected.length < limit) {
    const previous = selected.at(-1);
    let index = remaining.findIndex(
      (candidate) =>
        !previous ||
        (candidate.creatorId !== previous.creatorId &&
          candidate.categoryId !== previous.categoryId),
    );
    if (index < 0) index = 0;
    selected.push(remaining.splice(index, 1)[0]);
  }
  return selected;
}

export async function getStoryFeed(
  actor: StoryActor,
  input: { storySlug?: string; limit?: number } = {},
) {
  const limit = Math.min(30, Math.max(1, input.limit ?? 18));
  const memberships = await prisma.communityMember.findMany({
    where: { userId: actor.id },
    select: { communityId: true },
  });
  const communityIds = new Set(memberships.map((item) => item.communityId));
  const candidates = await prisma.story.findMany({
    where: visibleStoryWhere(actor),
    include: storyFeedInclude(actor.id),
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 80,
  });
  candidates.sort(
    (left, right) =>
      scoreStory(right, actor, communityIds) -
      scoreStory(left, actor, communityIds),
  );
  const records = diversify(candidates, limit);
  if (input.storySlug) {
    const selectedIndex = records.findIndex(
      (story) => story.slug === input.storySlug,
    );
    if (selectedIndex > 0) {
      records.unshift(records.splice(selectedIndex, 1)[0]);
    } else if (selectedIndex < 0) {
      const selected = candidates.find(
        (story) => story.slug === input.storySlug,
      );
      if (selected) records.unshift(selected);
    }
  }
  return records
    .slice(0, limit)
    .map((story) => storyDto(story, actor, communityIds));
}

export type StoryFeedItem = Awaited<ReturnType<typeof getStoryFeed>>[number];

export async function getContextualStories(
  actor: StoryActor,
  input: {
    citySlug?: string;
    communityId?: string;
    universityId?: string;
    creatorId?: string;
    limit?: number;
  },
) {
  const limit = Math.min(8, Math.max(1, input.limit ?? 5));
  const memberships = await prisma.communityMember.findMany({
    where: { userId: actor.id },
    select: { communityId: true },
  });
  const communityIds = new Set(memberships.map((item) => item.communityId));
  const contextFilters: Prisma.StoryWhereInput[] = [];
  if (input.citySlug) {
    contextFilters.push({
      entityLinks: { some: { city: { slug: input.citySlug } } },
    });
  }
  if (input.communityId) {
    contextFilters.push({
      entityLinks: { some: { communityId: input.communityId } },
    });
  }
  if (input.universityId) {
    contextFilters.push({
      entityLinks: { some: { universityId: input.universityId } },
    });
  }
  if (input.creatorId) contextFilters.push({ creatorId: input.creatorId });
  if (!contextFilters.length) return [];

  const records = await prisma.story.findMany({
    where: { AND: [visibleStoryWhere(actor), { OR: contextFilters }] },
    include: storyFeedInclude(actor.id),
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: limit,
  });
  return records.map((story) => storyDto(story, actor, communityIds));
}

function canPublishDirectly(actor: StoryActor) {
  return (
    hasAdminPermission(actor.role, "STORY_CMS_MANAGE") ||
    actor.storyCreatorStatus === "APPROVED_CREATOR" ||
    actor.storyCreatorStatus === "TRUSTED_CREATOR"
  );
}

async function resolveEntityLinks(
  links: StorySubmission["entityLinks"],
): Promise<Prisma.StoryEntityLinkCreateWithoutStoryInput[]> {
  return Promise.all(
    links.map(async (link) => {
      if (link.type === "CITY") {
        const city = await prisma.city.findFirst({
          where: { id: link.entityId, isActive: true },
          select: { id: true },
        });
        if (!city) throw new StoryError("Selected city was not found.", 404);
        return { type: link.type, city: { connect: { id: city.id } } };
      }
      if (link.type === "UNIVERSITY") {
        const university = await prisma.university.findFirst({
          where: { id: link.entityId, isActive: true },
          select: { id: true },
        });
        if (!university) {
          throw new StoryError("Selected university was not found.", 404);
        }
        return {
          type: link.type,
          university: { connect: { id: university.id } },
        };
      }
      if (link.type === "COMMUNITY") {
        const community = await prisma.community.findFirst({
          where: { id: link.entityId, status: "ACTIVE" },
          select: { id: true },
        });
        if (!community) {
          throw new StoryError("Selected community was not found.", 404);
        }
        return {
          type: link.type,
          community: { connect: { id: community.id } },
        };
      }
      return {
        type: link.type,
        externalEntityId: link.entityId,
        externalLabel: link.label,
        externalHref: link.href,
      };
    }),
  );
}

export async function createStorySubmission(
  actor: StoryActor,
  input: StorySubmission,
  meta: RequestMeta = {},
) {
  if (actor.storyCreatorStatus === "SUSPENDED") {
    throw new StoryError(
      "Story publishing is suspended for this account.",
      403,
    );
  }
  const [category, video, poster, entityLinks] = await Promise.all([
    prisma.storyCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true },
    }),
    prisma.mediaAsset.findFirst({
      where: {
        id: input.videoMediaId,
        ownerId: actor.id,
        purpose: "STORY_VIDEO",
        kind: "VIDEO",
        status: "ACTIVE",
        scanStatus: "CLEAN",
      },
      select: { id: true, durationSeconds: true },
    }),
    input.posterMediaId
      ? prisma.mediaAsset.findFirst({
          where: {
            id: input.posterMediaId,
            ownerId: actor.id,
            purpose: "STORY_POSTER",
            kind: "IMAGE",
            status: "ACTIVE",
            scanStatus: "CLEAN",
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    resolveEntityLinks(input.entityLinks),
  ]);
  if (!category) throw new StoryError("Story category was not found.", 404);
  if (!video?.durationSeconds) {
    throw new StoryError("Validated story video was not found.", 400);
  }
  const durationSeconds = video.durationSeconds;
  if (input.posterMediaId && !poster) {
    throw new StoryError("Validated story poster was not found.", 400);
  }
  const direct = canPublishDirectly(actor);
  const status: StoryStatus = direct ? "PUBLISHED" : "PENDING_REVIEW";
  const slug = `${input.title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)}-${randomUUID().slice(0, 8)}`;

  const story = await prisma.$transaction(async (tx) => {
    const created = await tx.story.create({
      data: {
        slug,
        creatorId: actor.id,
        categoryId: category.id,
        videoMediaId: video.id,
        posterMediaId: poster?.id,
        status,
        title: input.title,
        description: input.description,
        language: input.language,
        durationSeconds,
        captions: input.captions,
        publishedAt: direct ? new Date() : null,
        moderatedAt: direct ? new Date() : null,
        entityLinks: { create: entityLinks },
        moderationEvents: {
          create: {
            actorId: actor.id,
            toStatus: status,
            reason: direct
              ? "Published through an authorized creator permission."
              : "Submitted for Kondo moderation.",
          },
        },
      },
    });
    await attachMediaAsset(tx, {
      ownerId: actor.id,
      assetId: video.id,
      purpose: "STORY_VIDEO",
      attachmentType: "STORY_VIDEO",
      attachmentId: created.id,
    });
    if (poster) {
      await attachMediaAsset(tx, {
        ownerId: actor.id,
        assetId: poster.id,
        purpose: "STORY_POSTER",
        attachmentType: "STORY_POSTER",
        attachmentId: created.id,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: direct ? "STORY_PUBLISHED" : "STORY_SUBMITTED",
      entityType: "Story",
      entityId: created.id,
      newValue: {
        status,
        categoryId: category.id,
        durationSeconds: video.durationSeconds,
        entityLinkCount: entityLinks.length,
      },
      ...meta,
    });
    return created;
  });
  return {
    id: story.id,
    slug: story.slug,
    status: story.status,
    href: storyHref(story.slug),
  };
}

export async function listOwnStorySubmissions(actor: StoryActor) {
  return prisma.story.findMany({
    where: { creatorId: actor.id },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      revision: true,
      moderationReason: true,
      publishedAt: true,
      updatedAt: true,
      posterMediaId: true,
      category: { select: { name: true, icon: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

export async function getOwnStorySubmissionForEditing(
  actor: StoryActor,
  storyId?: string,
) {
  if (!storyId) return null;
  return prisma.story.findFirst({
    where: {
      id: storyId,
      creatorId: actor.id,
      status: { in: ["DRAFT", "CHANGES_REQUESTED"] },
    },
    select: {
      id: true,
      title: true,
      description: true,
      language: true,
      captions: true,
      categoryId: true,
      posterMediaId: true,
      moderationReason: true,
      entityLinks: {
        select: {
          type: true,
          cityId: true,
          universityId: true,
          communityId: true,
          externalEntityId: true,
          externalLabel: true,
          externalHref: true,
        },
      },
    },
  });
}

export async function reviseStorySubmission(
  actor: StoryActor,
  storyId: string,
  input: StoryRevision,
  meta: RequestMeta = {},
) {
  const current = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, creatorId: true, status: true, revision: true },
  });
  if (!current) throw new StoryError("Story was not found.", 404);
  if (current.creatorId !== actor.id)
    throw new StoryError("Access denied.", 403);
  if (!["DRAFT", "CHANGES_REQUESTED"].includes(current.status)) {
    throw new StoryError("This story cannot be resubmitted.", 409);
  }
  const [category, entityLinks] = await Promise.all([
    prisma.storyCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
      select: { id: true },
    }),
    resolveEntityLinks(input.entityLinks),
  ]);
  if (!category) throw new StoryError("Story category was not found.", 404);

  return prisma.$transaction(async (tx) => {
    await tx.storyEntityLink.deleteMany({ where: { storyId } });
    const updated = await tx.story.update({
      where: { id: storyId },
      data: {
        categoryId: category.id,
        title: input.title,
        description: input.description,
        language: input.language,
        captions: input.captions,
        status: "RESUBMITTED",
        moderationReason: null,
        revision: { increment: 1 },
        entityLinks: { create: entityLinks },
        moderationEvents: {
          create: {
            actorId: actor.id,
            fromStatus: current.status,
            toStatus: "RESUBMITTED",
            reason: "Creator resubmitted the requested changes.",
          },
        },
      },
      select: { id: true, slug: true, status: true, revision: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "STORY_RESUBMITTED",
      entityType: "Story",
      entityId: storyId,
      oldValue: { status: current.status, revision: current.revision },
      newValue: { status: updated.status, revision: updated.revision },
      ...meta,
    });
    return updated;
  });
}

export async function updateStoryInteraction(
  actor: StoryActor,
  storyId: string,
  input: StoryInteraction,
) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ...visibleStoryWhere(actor) },
    select: { id: true },
  });
  if (!story) throw new StoryError("Story was not found.", 404);
  const key = { storyId_userId: { storyId, userId: actor.id } };
  if (input.action === "LIKE") {
    if (input.active) {
      await prisma.storyLike.upsert({
        where: key,
        update: {},
        create: { storyId, userId: actor.id },
      });
    } else {
      await prisma.storyLike.deleteMany({
        where: { storyId, userId: actor.id },
      });
    }
  } else if (input.action === "SAVE") {
    if (input.active) {
      await prisma.storySave.upsert({
        where: key,
        update: {},
        create: { storyId, userId: actor.id },
      });
    } else {
      await prisma.storySave.deleteMany({
        where: { storyId, userId: actor.id },
      });
    }
  } else if (input.active) {
    await prisma.storyHide.upsert({
      where: key,
      update: { reason: input.reason },
      create: {
        storyId,
        userId: actor.id,
        reason: input.reason,
      },
    });
  } else {
    await prisma.storyHide.deleteMany({
      where: { storyId, userId: actor.id },
    });
  }
  return { action: input.action, active: input.active };
}

export async function listStoryComments(actor: StoryActor, storyId: string) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ...visibleStoryWhere(actor) },
    select: { id: true, commentsEnabled: true },
  });
  if (!story) throw new StoryError("Story was not found.", 404);
  const comments = await prisma.storyComment.findMany({
    where: { storyId, status: "PUBLISHED" },
    select: {
      id: true,
      content: true,
      parentId: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          username: true,
          avatarMediaId: true,
          officialProfileStatus: true,
          officialOrganizationType: true,
          officialOrganizationName: true,
          officialVerifiedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return {
    enabled: story.commentsEnabled,
    comments: comments.map((comment) => {
      const official = toSafePublicOfficialFields(comment.author);
      return {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        author: {
          ...comment.author,
          ...official,
          name: `${comment.author.firstName} ${comment.author.lastName}`,
          official: official.officialProfileStatus === "APPROVED",
          officialVerifiedAt:
            official.officialVerifiedAt?.toISOString() ?? null,
        },
        viewer: { canDelete: comment.author.id === actor.id },
      };
    }),
  };
}

export async function addStoryComment(
  actor: StoryActor,
  storyId: string,
  input: StoryCommentInput,
) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, ...visibleStoryWhere(actor) },
    select: { id: true, commentsEnabled: true, creatorId: true, slug: true },
  });
  if (!story) throw new StoryError("Story was not found.", 404);
  if (!story.commentsEnabled) {
    throw new StoryError("Comments are disabled for this story.", 409);
  }
  if (input.parentId) {
    const parent = await prisma.storyComment.findFirst({
      where: { id: input.parentId, storyId, status: "PUBLISHED" },
      select: { id: true },
    });
    if (!parent) throw new StoryError("Reply target was not found.", 404);
  }
  return prisma.$transaction(async (tx) => {
    const comment = await tx.storyComment.create({
      data: {
        storyId,
        authorId: actor.id,
        parentId: input.parentId,
        content: input.content,
      },
      select: { id: true, createdAt: true },
    });
    if (story.creatorId !== actor.id) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: story.creatorId,
        actorId: actor.id,
        type: input.parentId ? "REPLY" : "COMMENT",
        templateKey: "POST_COMMENT",
        data: { actorName: "A Kondo member", preview: input.content },
        href: storyHref(story.slug),
        dedupeKey: `story-comment:${comment.id}`,
      });
    }
    return { id: comment.id, createdAt: comment.createdAt.toISOString() };
  });
}

export async function deleteStoryComment(
  actor: StoryActor,
  storyId: string,
  commentId: string,
) {
  const comment = await prisma.storyComment.findFirst({
    where: { id: commentId, storyId },
    select: { id: true, authorId: true },
  });
  if (!comment) throw new StoryError("Comment was not found.", 404);
  if (
    comment.authorId !== actor.id &&
    !hasAdminPermission(actor.role, "STORY_CMS_MANAGE")
  ) {
    throw new StoryError("Access denied.", 403);
  }
  await prisma.storyComment.update({
    where: { id: commentId },
    data: {
      status: "REMOVED",
      removedAt: new Date(),
      content: "[Removed]",
    },
  });
  return { removed: true };
}

export async function reportStory(
  actor: StoryActor,
  storyId: string,
  input: StoryReportInput,
  meta: RequestMeta = {},
) {
  const story = await prisma.story.findFirst({
    where: { id: storyId, status: "PUBLISHED" },
    select: { id: true, creatorId: true, title: true },
  });
  if (!story) throw new StoryError("Story was not found.", 404);
  if (story.creatorId === actor.id) {
    throw new StoryError("You cannot report your own story.", 409);
  }
  const existing = await prisma.report.findFirst({
    where: {
      reporterId: actor.id,
      targetType: "Story",
      targetId: storyId,
      status: { in: ["OPEN", "REVIEWING"] },
    },
    select: { id: true, status: true },
  });
  if (existing) return existing;
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.create({
      data: {
        reporterId: actor.id,
        subjectUserId: story.creatorId,
        targetType: "Story",
        targetId: story.id,
        reason: input.reason,
        details: input.details,
      },
      select: { id: true, status: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "STORY_REPORTED",
      entityType: "Report",
      entityId: report.id,
      newValue: {
        storyId: story.id,
        reason: input.reason,
      },
      ...meta,
    });
    return report;
  });
}

export async function listAdminStories(
  actor: StoryActor,
  input: { status?: StoryStatus; query?: string; page?: number } = {},
) {
  if (!hasAdminPermission(actor.role, "STORY_CMS_VIEW")) {
    throw new StoryError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = 25;
  const where: Prisma.StoryWhereInput = {
    status: input.status,
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
            {
              creator: {
                OR: [
                  {
                    firstName: {
                      contains: input.query,
                      mode: "insensitive",
                    },
                  },
                  {
                    lastName: {
                      contains: input.query,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          ],
        }
      : {}),
  };
  const [total, stories] = await prisma.$transaction([
    prisma.story.count({ where }),
    prisma.story.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        durationSeconds: true,
        videoMediaId: true,
        posterMediaId: true,
        isFeatured: true,
        isInstitutional: true,
        qualityScore: true,
        moderationReason: true,
        publishedAt: true,
        scheduledAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, icon: true } },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            storyCreatorStatus: true,
            officialProfileStatus: true,
          },
        },
        entityLinks: {
          select: {
            id: true,
            type: true,
            city: { select: { name: true } },
            university: { select: { name: true } },
            community: { select: { name: true } },
            externalLabel: true,
          },
        },
        _count: {
          select: {
            likes: true,
            saves: true,
            comments: true,
            moderationEvents: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: stories,
    page,
    pageSize,
    total,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const transitionTargets: Partial<Record<StoryStatus, readonly StoryStatus[]>> =
  {
    PENDING_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "REMOVED"],
    RESUBMITTED: ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "REMOVED"],
    APPROVED: ["PUBLISHED", "SCHEDULED", "ARCHIVED"],
    SCHEDULED: ["PUBLISHED", "ARCHIVED", "REMOVED"],
    PUBLISHED: ["REMOVED", "ARCHIVED"],
    CHANGES_REQUESTED: ["REJECTED", "REMOVED"],
    REJECTED: ["PENDING_REVIEW", "ARCHIVED"],
    ARCHIVED: ["PUBLISHED"],
  };

export async function transitionStoryAsAdmin(
  actor: StoryActor,
  storyId: string,
  input: StoryTransitionInput,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "STORY_CMS_MANAGE")) {
    throw new StoryError("Access denied.", 403);
  }
  const current = await prisma.story.findUnique({
    where: { id: storyId },
    select: {
      id: true,
      slug: true,
      creatorId: true,
      status: true,
      revision: true,
      isFeatured: true,
      isInstitutional: true,
      qualityScore: true,
    },
  });
  if (!current) throw new StoryError("Story was not found.", 404);
  const stateChanged = input.status !== current.status;
  if (
    stateChanged &&
    !transitionTargets[current.status]?.includes(input.status)
  ) {
    throw new StoryError(
      `Story cannot move from ${current.status} to ${input.status}.`,
      409,
    );
  }
  if (
    ["CHANGES_REQUESTED", "REJECTED", "REMOVED"].includes(input.status) &&
    !input.reason
  ) {
    throw new StoryError("A clear moderation reason is required.");
  }
  if (
    input.status === "SCHEDULED" &&
    (!input.scheduledAt || input.scheduledAt <= new Date())
  ) {
    throw new StoryError("Choose a future publication date.");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.story.update({
      where: { id: storyId },
      data: {
        status: input.status,
        moderationReason: input.reason,
        moderatedAt: new Date(),
        scheduledAt:
          input.status === "SCHEDULED"
            ? input.scheduledAt
            : input.status === "PUBLISHED"
              ? null
              : undefined,
        publishedAt:
          input.status === "PUBLISHED"
            ? new Date()
            : input.status === "ARCHIVED"
              ? null
              : undefined,
        removedAt: input.status === "REMOVED" ? new Date() : undefined,
        isFeatured: input.isFeatured,
        isInstitutional: input.isInstitutional,
        qualityScore: input.qualityScore,
        moderationEvents: stateChanged
          ? {
              create: {
                actorId: actor.id,
                fromStatus: current.status,
                toStatus: input.status,
                reason: input.reason,
                internalNote: input.internalNote,
              },
            }
          : undefined,
      },
      select: {
        id: true,
        slug: true,
        status: true,
        isFeatured: true,
        isInstitutional: true,
        qualityScore: true,
      },
    });
    if (stateChanged) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: current.creatorId,
        actorId: actor.id,
        type: "MODERATION_UPDATE",
        templateKey: "MODERATION_RESULT",
        data: {
          outcome:
            input.status === "CHANGES_REQUESTED"
              ? `Your Student Story needs changes: ${input.reason}`
              : `Your Student Story is now ${input.status.toLowerCase().replaceAll("_", " ")}.`,
        },
        href:
          input.status === "PUBLISHED"
            ? storyHref(current.slug)
            : `/stories/submit?story=${current.id}`,
        dedupeKey: `story-moderation:${storyId}:${current.revision}:${input.status}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: stateChanged
        ? `STORY_${input.status}`
        : "STORY_EDITORIAL_UPDATED",
      entityType: "Story",
      entityId: storyId,
      oldValue: {
        status: current.status,
        isFeatured: current.isFeatured,
        isInstitutional: current.isInstitutional,
        qualityScore: current.qualityScore,
      },
      newValue: {
        status: updated.status,
        isFeatured: updated.isFeatured,
        isInstitutional: updated.isInstitutional,
        qualityScore: updated.qualityScore,
        reason: input.reason,
      },
      ...meta,
    });
    return updated;
  });
}

export async function publishScheduledStories(
  input: { limit?: number; now?: Date } = {},
) {
  const now = input.now ?? new Date();
  const limit = Math.min(100, Math.max(1, input.limit ?? 50));
  const scheduled = await prisma.story.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { not: null, lte: now },
    },
    select: {
      id: true,
      slug: true,
      creatorId: true,
      scheduledAt: true,
      revision: true,
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });
  const publishedIds: string[] = [];
  for (const story of scheduled) {
    const published = await prisma.$transaction(async (tx) => {
      const claimed = await tx.story.updateMany({
        where: {
          id: story.id,
          status: "SCHEDULED",
          scheduledAt: { not: null, lte: now },
        },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          scheduledAt: null,
          moderatedAt: now,
        },
      });
      if (!claimed.count) return false;
      await tx.storyModerationEvent.create({
        data: {
          storyId: story.id,
          fromStatus: "SCHEDULED",
          toStatus: "PUBLISHED",
          reason: "Published automatically at the scheduled time.",
        },
      });
      await enqueueNotificationJobWithClient(tx, {
        recipientId: story.creatorId,
        type: "MODERATION_UPDATE",
        templateKey: "MODERATION_RESULT",
        data: { outcome: "Your scheduled Student Story is now published." },
        href: storyHref(story.slug),
        dedupeKey: `story-scheduled-publish:${story.id}:${story.revision}`,
      });
      await writeAuditLogWithClient(tx, {
        action: "STORY_SCHEDULED_PUBLISHED",
        entityType: "Story",
        entityId: story.id,
        oldValue: {
          status: "SCHEDULED",
          scheduledAt: story.scheduledAt,
        },
        newValue: { status: "PUBLISHED", publishedAt: now },
      });
      return true;
    });
    if (published) publishedIds.push(story.id);
  }
  return {
    checked: scheduled.length,
    published: publishedIds.length,
    storyIds: publishedIds,
  };
}

export async function upsertStoryCategory(
  actor: StoryActor,
  input: StoryCategoryInput | StoryCategoryUpdate,
  categoryId?: string,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "STORY_CMS_MANAGE")) {
    throw new StoryError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const category = categoryId
      ? await tx.storyCategory.update({
          where: { id: categoryId },
          data: input,
        })
      : await tx.storyCategory.create({
          data: input as StoryCategoryInput,
        });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: categoryId ? "STORY_CATEGORY_UPDATED" : "STORY_CATEGORY_CREATED",
      entityType: "StoryCategory",
      entityId: category.id,
      newValue: {
        name: category.name,
        slug: category.slug,
        isActive: category.isActive,
        order: category.order,
      },
      ...meta,
    });
    return category;
  });
}

export async function updateStoryCreatorStatus(
  actor: StoryActor,
  userId: string,
  input: StoryCreatorStatusInput,
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "STORY_CMS_MANAGE")) {
    throw new StoryError("Access denied.", 403);
  }
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, storyCreatorStatus: true },
  });
  if (!current) throw new StoryError("Creator was not found.", 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { storyCreatorStatus: input.status },
      select: { id: true, storyCreatorStatus: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "STORY_CREATOR_STATUS_UPDATED",
      entityType: "User",
      entityId: userId,
      oldValue: { storyCreatorStatus: current.storyCreatorStatus },
      newValue: {
        storyCreatorStatus: updated.storyCreatorStatus,
        reason: input.reason,
      },
      ...meta,
    });
    return updated;
  });
}

export async function getStoryPublishingOptions(actor: StoryActor) {
  const [categories, cities, universities, communities] = await Promise.all([
    prisma.storyCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, icon: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    }),
    prisma.city.findMany({
      where: { isActive: true, users: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.community.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ isPrivate: false }, { members: { some: { userId: actor.id } } }],
      },
      select: { id: true, name: true, icon: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);
  return {
    categories,
    cities,
    universities,
    communities,
    canPublishDirectly: canPublishDirectly(actor),
  };
}

export function isMediaError(error: unknown): error is MediaError {
  return error instanceof MediaError;
}
