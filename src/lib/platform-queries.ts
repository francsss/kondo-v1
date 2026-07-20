import { prisma } from "@/lib/prisma";
import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedGuideWhere,
  publishedPostVisibilityWhere,
  publishedQuestionWhere,
} from "@/lib/content-visibility";

export async function getHomeData(userId: string) {
  const [posts, communities, listings, guides, upcomingEvents] =
    await Promise.all([
      prisma.post.findMany({
        where: {
          ...publishedPostVisibilityWhere({ id: userId }),
          type: { not: "EVENT" },
        },
        include: {
          author: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarKey: true,
              country: { select: { emoji: true } },
              university: { select: { shortName: true, name: true } },
            },
          },
          community: {
            select: { name: true, slug: true, icon: true, isVerified: true },
          },
          reactions: {
            where: { userId, type: "HELPFUL" },
            select: { id: true },
          },
          media: {
            orderBy: { order: "asc" },
            select: {
              media: { select: { id: true, altText: true } },
            },
          },
          _count: {
            select: {
              comments: { where: { status: "PUBLISHED" } },
              reactions: true,
            },
          },
        },
        orderBy: [{ pinnedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
      }),
      prisma.community.findMany({
        where: communityVisibilityWhere({ id: userId }),
        include: {
          members: { where: { userId }, select: { id: true, role: true } },
          _count: {
            select: {
              members: true,
              posts: { where: { status: "PUBLISHED" } },
            },
          },
        },
        orderBy: [{ isVerified: "desc" }, { members: { _count: "desc" } }],
        take: 6,
      }),
      prisma.marketplaceListing.findMany({
        where: activeListingWhere(),
        include: {
          images: { orderBy: { order: "asc" }, take: 1 },
          category: { select: { name: true, icon: true } },
          city: { select: { name: true } },
          seller: { select: { firstName: true, lastName: true } },
          favorites: { where: { userId }, select: { id: true } },
          _count: { select: { favorites: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 4,
      }),
      prisma.guide.findMany({
        where: publishedGuideWhere,
        include: {
          steps: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              progress: { where: { userId }, select: { id: true } },
            },
          },
        },
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
        take: 4,
      }),
      prisma.post.findMany({
        where: {
          ...publishedPostVisibilityWhere({ id: userId }),
          type: "EVENT",
          eventAt: { gte: new Date() },
          eventValidatedAt: { not: null },
        },
        include: {
          community: { select: { name: true, slug: true, icon: true } },
          _count: {
            select: {
              comments: { where: { status: "PUBLISHED" } },
              reactions: true,
            },
          },
        },
        orderBy: { eventAt: "asc" },
        take: 3,
      }),
    ]);

  return { posts, communities, listings, guides, upcomingEvents };
}

export async function getCommunityDirectory(
  userId: string,
  input: {
    page?: number;
    pageSize?: number;
    type?: "COUNTRY" | "CITY" | "UNIVERSITY" | "TOPIC";
    joined?: boolean;
    query?: string;
  } = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(30, Math.max(6, Math.floor(input.pageSize ?? 12)));
  const query = input.query?.trim();
  const where = {
    AND: [
      communityVisibilityWhere({ id: userId }),
      input.type ? { type: input.type } : {},
      input.joined ? { members: { some: { userId } } } : {},
      query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              {
                description: {
                  contains: query,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {},
    ],
  };
  const [total, communities] = await Promise.all([
    prisma.community.count({ where }),
    prisma.community.findMany({
      where,
      include: {
        members: { where: { userId }, select: { id: true, role: true } },
        accessRequests: {
          where: { userId, status: "PENDING" },
          select: { id: true, type: true },
        },
        _count: {
          select: {
            members: true,
            posts: { where: { status: "PUBLISHED" } },
          },
        },
        posts: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          select: { title: true, content: true, createdAt: true },
          take: 1,
        },
      },
      orderBy: [{ isVerified: "desc" }, { members: { _count: "desc" } }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    communities,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getMarketplaceData(userId: string) {
  const [categories, listings] = await Promise.all([
    prisma.marketplaceCategory.findMany({
      include: {
        _count: {
          select: { listings: { where: activeListingWhere() } },
        },
      },
      orderBy: { order: "asc" },
    }),
    prisma.marketplaceListing.findMany({
      where: activeListingWhere(),
      include: {
        images: { orderBy: { order: "asc" }, take: 1 },
        category: true,
        city: { select: { name: true } },
        seller: {
          select: {
            firstName: true,
            lastName: true,
            country: { select: { emoji: true } },
          },
        },
        favorites: { where: { userId }, select: { id: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return { categories, listings };
}

export async function getGuideLibrary(userId: string) {
  const [guides, bookmarks] = await Promise.all([
    prisma.guide.findMany({
      where: publishedGuideWhere,
      include: {
        steps: {
          orderBy: { order: "asc" },
          include: { progress: { where: { userId }, select: { id: true } } },
        },
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
    }),
    prisma.bookmark.findMany({
      where: { userId, targetType: "GUIDE" },
      select: { targetId: true },
    }),
  ]);
  const bookmarkedIds = new Set(bookmarks.map((bookmark) => bookmark.targetId));
  return guides.map((guide) => ({
    ...guide,
    bookmarked: bookmarkedIds.has(guide.id),
  }));
}

export async function getHelpQuestions() {
  return prisma.question.findMany({
    where: publishedQuestionWhere,
    include: {
      author: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          country: { select: { emoji: true } },
        },
      },
      answers: {
        where: { status: "PUBLISHED" },
        include: { _count: { select: { votes: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      _count: {
        select: { answers: { where: { status: "PUBLISHED" } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProfile(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      country: true,
      city: true,
      university: true,
      communityMemberships: {
        where: {
          community: communityVisibilityWhere({ id: userId }),
        },
        include: { community: true },
        orderBy: { joinedAt: "desc" },
        take: 6,
      },
      posts: {
        where: publishedPostVisibilityWhere({ id: userId }),
        include: {
          community: true,
          _count: {
            select: {
              comments: { where: { status: "PUBLISHED" } },
              reactions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      marketplaceListings: {
        where: activeListingWhere(),
        orderBy: { createdAt: "desc" },
        take: 4,
      },
      _count: {
        select: {
          communityMemberships: {
            where: {
              community: communityVisibilityWhere({ id: userId }),
            },
          },
          posts: {
            where: publishedPostVisibilityWhere({ id: userId }),
          },
          marketplaceListings: { where: activeListingWhere() },
        },
      },
    },
  });
}
