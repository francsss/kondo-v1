import type { Prisma } from "@prisma/client";
import type {
  HomeActivityActor,
  HomeActivityItem,
} from "@/features/activity/types";
import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedPostVisibilityWhere,
} from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";

const activityUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  avatarMediaId: true,
  profileAudience: true,
  createdAt: true,
  country: { select: { emoji: true } },
  university: { select: { shortName: true, name: true } },
} satisfies Prisma.UserSelect;

type ActivityUser = Prisma.UserGetPayload<{
  select: typeof activityUserSelect;
}>;

function actor(user: ActivityUser): HomeActivityActor {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarMediaId: user.avatarMediaId,
    countryEmoji: user.country?.emoji ?? null,
  };
}

function userDetail(user: ActivityUser) {
  return user.university?.shortName ?? user.university?.name ?? null;
}

export function mergeHomeActivities(groups: HomeActivityItem[][], limit = 18) {
  return groups
    .flat()
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime(),
    )
    .slice(0, limit);
}

export async function getHomeActivityStream(viewer: {
  id: string;
  role?: string | null;
}) {
  const visibleCommunities = communityVisibilityWhere(viewer);
  const visiblePosts = publishedPostVisibilityWhere(viewer);
  const now = new Date();

  const [
    members,
    posts,
    comments,
    memberships,
    communities,
    cityHubs,
    listings,
    events,
  ] = await Promise.all([
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        profileAudience: { not: "PRIVATE" },
      },
      select: activityUserSelect,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.post.findMany({
      where: { ...visiblePosts, type: { not: "EVENT" } },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        author: { select: activityUserSelect },
        community: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.comment.findMany({
      where: {
        status: "PUBLISHED",
        post: { is: visiblePosts },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: activityUserSelect },
        post: {
          select: {
            id: true,
            title: true,
            community: { select: { name: true, slug: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.communityMember.findMany({
      where: {
        community: { is: visibleCommunities },
        user: {
          is: {
            status: "ACTIVE",
            profileAudience: { not: "PRIVATE" },
          },
        },
      },
      select: {
        id: true,
        joinedAt: true,
        user: { select: activityUserSelect },
        community: { select: { name: true, slug: true } },
      },
      orderBy: { joinedAt: "desc" },
      take: 6,
    }),
    prisma.community.findMany({
      where: visibleCommunities,
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        createdBy: { select: activityUserSelect },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.cityHub.findMany({
      where: { status: "PUBLISHED", publishedAt: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
    prisma.marketplaceListing.findMany({
      where: activeListingWhere(now),
      select: {
        id: true,
        slug: true,
        title: true,
        publishedAt: true,
        createdAt: true,
        seller: { select: activityUserSelect },
        category: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    }),
    prisma.post.findMany({
      where: {
        ...visiblePosts,
        type: "EVENT",
        eventAt: { gte: now },
        eventValidatedAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        content: true,
        eventAt: true,
        createdAt: true,
        author: { select: activityUserSelect },
        community: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
  ]);

  return mergeHomeActivities([
    members.map((member) => ({
      id: `member-${member.id}`,
      type: "MEMBER_JOINED" as const,
      occurredAt: member.createdAt.toISOString(),
      actor: actor(member),
      action: "just joined Kondo",
      subject: null,
      detail: userDetail(member),
      href: member.username ? `/profile/${member.username}` : "/communities",
    })),
    posts.map((post) => ({
      id: `post-${post.id}`,
      type: "POST_CREATED" as const,
      occurredAt: post.createdAt.toISOString(),
      actor: actor(post.author),
      action: "shared a new post in",
      subject: post.community.name,
      detail: post.title ?? post.content.slice(0, 92),
      href: `/communities/${post.community.slug}?post=${post.id}`,
    })),
    comments.map((comment) => ({
      id: `comment-${comment.id}`,
      type: "COMMENT_CREATED" as const,
      occurredAt: comment.createdAt.toISOString(),
      actor: actor(comment.author),
      action: "joined the conversation in",
      subject: comment.post.community.name,
      detail: comment.content.slice(0, 92),
      href: `/communities/${comment.post.community.slug}?post=${comment.post.id}`,
    })),
    memberships.map((membership) => ({
      id: `membership-${membership.id}`,
      type: "COMMUNITY_JOINED" as const,
      occurredAt: membership.joinedAt.toISOString(),
      actor: actor(membership.user),
      action: "joined the community",
      subject: membership.community.name,
      detail: userDetail(membership.user),
      href: `/communities/${membership.community.slug}`,
    })),
    communities.map((community) => ({
      id: `community-${community.id}`,
      type: "COMMUNITY_CREATED" as const,
      occurredAt: community.createdAt.toISOString(),
      actor:
        community.createdBy.profileAudience === "PRIVATE"
          ? null
          : actor(community.createdBy),
      action:
        community.createdBy.profileAudience === "PRIVATE"
          ? "A new community opened"
          : "created a new community",
      subject: community.name,
      detail: "A new place to meet, share and belong.",
      href: `/communities/${community.slug}`,
    })),
    cityHubs.flatMap((hub) =>
      hub.publishedAt
        ? [
            {
              id: `city-hub-${hub.id}`,
              type: "CITY_HUB_PUBLISHED" as const,
              occurredAt: hub.publishedAt.toISOString(),
              actor: null,
              action: "A new city is live in Explore",
              subject: hub.name,
              detail: "Local companies, opportunities, places and services.",
              href: `/explore/${hub.slug}`,
            },
          ]
        : [],
    ),
    listings.map((listing) => ({
      id: `listing-${listing.id}`,
      type: "LISTING_CREATED" as const,
      occurredAt: (listing.publishedAt ?? listing.createdAt).toISOString(),
      actor: actor(listing.seller),
      action: "listed something new",
      subject: listing.title,
      detail: listing.category.name,
      href: `/marketplace/${listing.slug}`,
    })),
    events.map((event) => ({
      id: `event-${event.id}`,
      type: "EVENT_UPCOMING" as const,
      occurredAt: event.createdAt.toISOString(),
      actor: actor(event.author),
      action: "added an upcoming event in",
      subject: event.community.name,
      detail: `${event.title ?? event.content.slice(0, 72)}${
        event.eventAt
          ? ` · ${new Intl.DateTimeFormat("en", {
              month: "short",
              day: "numeric",
            }).format(event.eventAt)}`
          : ""
      }`,
      href: `/communities/${event.community.slug}?post=${event.id}`,
    })),
  ]);
}
