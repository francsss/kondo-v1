import { Prisma } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedGuideWhere,
  publishedPostVisibilityWhere,
  publishedQuestionWhere,
} from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import {
  safePublicUserSelect,
  type SearchResultsDto,
  toSafePublicUser,
} from "@/lib/serializers";

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "SearchError";
  }
}

export const SEARCH_CATEGORIES = [
  "communities",
  "listings",
  "guides",
  "questions",
  "users",
  "posts",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

type RankedRow = { id: string; rank: number };
type Cursor = { rank: number; id: string };

const CATEGORY_TABLE: Record<SearchCategory, Prisma.Sql> = {
  communities: Prisma.sql`"Community"`,
  listings: Prisma.sql`"MarketplaceListing"`,
  guides: Prisma.sql`"Guide"`,
  questions: Prisma.sql`"Question"`,
  users: Prisma.sql`"User"`,
  posts: Prisma.sql`"Post"`,
};

// Lifecycle rules that map 1:1 to a boolean/enum column are baked directly into
// the raw candidate query. Visibility that depends on relational membership
// (community privacy, post-community visibility) is intentionally left out here
// and re-checked through the existing typed Prisma policies in content-visibility.ts.
const CATEGORY_FILTER: Record<SearchCategory, Prisma.Sql> = {
  communities: Prisma.empty,
  listings: Prisma.sql`AND "status" = 'ACTIVE' AND "expiresAt" > now() AND EXISTS (SELECT 1 FROM "MarketplaceCategory" c WHERE c."id" = "MarketplaceListing"."categoryId" AND c."isActive")`,
  guides: Prisma.sql`AND "published" = true`,
  questions: Prisma.sql`AND "status" = 'PUBLISHED'`,
  users: Prisma.sql`AND "status" = 'ACTIVE'`,
  posts: Prisma.sql`AND "status" = 'PUBLISHED' AND EXISTS (SELECT 1 FROM "User" u WHERE u."id" = "Post"."authorId" AND u."status" = 'ACTIVE')`,
};

// Categories whose CATEGORY_FILTER above cannot fully encode visibility and may
// therefore return raw candidates that a later Prisma-level check rejects.
const NEEDS_OVERFETCH: Record<SearchCategory, boolean> = {
  communities: true,
  listings: false,
  guides: false,
  questions: false,
  users: false,
  posts: true,
};

async function rankedIds(
  category: SearchCategory,
  term: string,
  limit: number,
  cursor?: Cursor,
): Promise<RankedRow[]> {
  const table = CATEGORY_TABLE[category];
  const filter = CATEGORY_FILTER[category];
  // Cast rank to double precision so the value that leaves PostgreSQL and the
  // value sent back inside a cursor compare byte-identically; ts_rank's native
  // `real` result loses precision on the wire and breaks tie-breaking between
  // rows with near-equal relevance.
  const rankExpr = Prisma.sql`ts_rank("searchVector", websearch_to_tsquery('simple', ${term}))::float8`;
  const cursorClause = cursor
    ? Prisma.sql`AND (${rankExpr}, "id") < (${cursor.rank}::float8, ${cursor.id})`
    : Prisma.empty;
  return prisma.$queryRaw<RankedRow[]>(Prisma.sql`
    SELECT "id", ${rankExpr} AS "rank"
    FROM ${table}
    WHERE "searchVector" @@ websearch_to_tsquery('simple', ${term})
    ${filter}
    ${cursorClause}
    ORDER BY "rank" DESC, "id" DESC
    LIMIT ${limit}
  `);
}

function orderByRank<T extends { id: string }>(
  items: T[],
  ranked: RankedRow[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const row of ranked) {
    const item = byId.get(row.id);
    if (item) ordered.push(item);
  }
  return ordered;
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): Cursor {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.rank === "number" &&
      typeof parsed.id === "string"
    ) {
      return parsed as Cursor;
    }
  } catch {
    // fall through to error below
  }
  throw new SearchError("Invalid search cursor.");
}

function validateTerm(query: string) {
  const term = query.trim();
  if (term.length < 2 || term.length > 100) {
    throw new SearchError("Search must be between 2 and 100 characters.");
  }
  return term;
}

/** Preview search used by the header Command/Ctrl+K box and /search landing. */
export async function searchKondo(
  query: string,
  userId: string,
): Promise<SearchResultsDto> {
  const term = query.trim();
  if (term.length < 2 || term.length > 100) {
    return {
      communities: [],
      listings: [],
      guides: [],
      questions: [],
      users: [],
      posts: [],
    };
  }

  await trackEvent({
    name: "SEARCH_PERFORMED",
    userId,
    properties: { termLength: term.length },
  });

  const previewLimit = 6;
  const overfetchLimit = 24;
  const [
    communityRanks,
    listingRanks,
    guideRanks,
    questionRanks,
    userRanks,
    postRanks,
  ] = await Promise.all([
    rankedIds("communities", term, overfetchLimit),
    rankedIds("listings", term, previewLimit),
    rankedIds("guides", term, previewLimit),
    rankedIds("questions", term, previewLimit),
    rankedIds("users", term, previewLimit),
    rankedIds("posts", term, overfetchLimit),
  ]);

  const [communities, listings, guides, questions, users, posts] =
    await Promise.all([
      prisma.community.findMany({
        where: {
          AND: [
            communityVisibilityWhere({ id: userId }),
            { id: { in: communityRanks.map((row) => row.id) } },
          ],
        },
        select: {
          id: true,
          slug: true,
          name: true,
          icon: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.marketplaceListing.findMany({
        where: {
          ...activeListingWhere(),
          id: { in: listingRanks.map((row) => row.id) },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          priceFen: true,
          city: { select: { name: true } },
        },
      }),
      prisma.guide.findMany({
        where: {
          ...publishedGuideWhere,
          id: { in: guideRanks.map((row) => row.id) },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          estimatedMinutes: true,
        },
      }),
      prisma.question.findMany({
        where: {
          ...publishedQuestionWhere,
          id: { in: questionRanks.map((row) => row.id) },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          _count: {
            select: { answers: { where: { status: "PUBLISHED" } } },
          },
        },
      }),
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          id: { in: userRanks.map((row) => row.id) },
        },
        select: {
          ...safePublicUserSelect,
          degree: true,
          country: { select: { emoji: true } },
          university: { select: { shortName: true } },
        },
      }),
      prisma.post.findMany({
        where: {
          AND: [
            publishedPostVisibilityWhere({ id: userId }),
            { author: { status: "ACTIVE" } },
            { id: { in: postRanks.map((row) => row.id) } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          community: { select: { slug: true, name: true } },
          author: { select: safePublicUserSelect },
        },
      }),
    ]);

  return {
    communities: orderByRank(communities, communityRanks)
      .slice(0, previewLimit)
      .map((community) => ({
        id: community.id,
        slug: community.slug,
        name: community.name,
        icon: community.icon,
        memberCount: community._count.members,
      })),
    listings: orderByRank(listings, listingRanks).map((listing) => ({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      priceFen: listing.priceFen,
      cityName: listing.city.name,
    })),
    guides: orderByRank(guides, guideRanks),
    questions: orderByRank(questions, questionRanks).map((question) => ({
      id: question.id,
      slug: question.slug,
      title: question.title,
      answerCount: question._count.answers,
    })),
    users: orderByRank(users, userRanks).map((user) => ({
      ...toSafePublicUser(user),
      countryEmoji: user.country?.emoji ?? null,
      affiliation: user.university?.shortName ?? user.degree ?? null,
    })),
    posts: orderByRank(posts, postRanks)
      .slice(0, previewLimit)
      .map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        community: post.community,
        author: toSafePublicUser(post.author),
      })),
  };
}

export type SearchCategoryItem =
  SearchResultsDto[keyof SearchResultsDto][number];

export type SearchCategoryPage = {
  items: SearchCategoryItem[];
  nextCursor: string | null;
};

const MAX_OVERFETCH_ROUNDS = 4;

/** Cursor-paginated single-category "load more" results for /search?type=. */
export async function searchCategory(
  category: SearchCategory,
  query: string,
  userId: string,
  input: { cursor?: string; limit?: number },
): Promise<SearchCategoryPage> {
  const term = validateTerm(query);
  const limit = Math.min(30, Math.max(5, Math.floor(input.limit ?? 10)));
  let cursor = input.cursor ? decodeCursor(input.cursor) : undefined;

  const collected: Array<{ item: SearchCategoryItem; rank: RankedRow }> = [];
  let exhausted = false;
  let rounds = 0;

  while (
    collected.length < limit &&
    !exhausted &&
    rounds < MAX_OVERFETCH_ROUNDS
  ) {
    rounds += 1;
    const remaining = limit - collected.length;
    const fetchSize = NEEDS_OVERFETCH[category]
      ? Math.max(remaining * 3, 12)
      : remaining;
    const ranked = await rankedIds(category, term, fetchSize, cursor);
    if (!ranked.length) {
      exhausted = true;
      break;
    }
    cursor = { rank: ranked[ranked.length - 1]!.rank, id: ranked[ranked.length - 1]!.id };
    const items = await fetchCategoryItems(category, userId, ranked);
    const ordered = orderByRank(items, ranked);
    for (const item of ordered) {
      const row = ranked.find((candidate) => candidate.id === item.id)!;
      collected.push({ item: item as SearchCategoryItem, rank: row });
      if (collected.length >= limit) break;
    }
    if (ranked.length < fetchSize) exhausted = true;
  }

  const page = collected.slice(0, limit);
  const hasMore = page.length === limit && !exhausted;
  const last = page[page.length - 1]?.rank;
  return {
    items: page.map(({ item }) => item),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

async function fetchCategoryItems(
  category: SearchCategory,
  userId: string,
  ranked: RankedRow[],
): Promise<Array<{ id: string } & Record<string, unknown>>> {
  const ids = ranked.map((row) => row.id);
  switch (category) {
    case "communities": {
      const communities = await prisma.community.findMany({
        where: {
          AND: [communityVisibilityWhere({ id: userId }), { id: { in: ids } }],
        },
        select: {
          id: true,
          slug: true,
          name: true,
          icon: true,
          _count: { select: { members: true } },
        },
      });
      return communities.map((community) => ({
        id: community.id,
        slug: community.slug,
        name: community.name,
        icon: community.icon,
        memberCount: community._count.members,
      }));
    }
    case "listings": {
      const listings = await prisma.marketplaceListing.findMany({
        where: { ...activeListingWhere(), id: { in: ids } },
        select: {
          id: true,
          slug: true,
          title: true,
          priceFen: true,
          city: { select: { name: true } },
        },
      });
      return listings.map((listing) => ({
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        priceFen: listing.priceFen,
        cityName: listing.city.name,
      }));
    }
    case "guides": {
      return prisma.guide.findMany({
        where: { ...publishedGuideWhere, id: { in: ids } },
        select: { id: true, slug: true, title: true, estimatedMinutes: true },
      });
    }
    case "questions": {
      const questions = await prisma.question.findMany({
        where: { ...publishedQuestionWhere, id: { in: ids } },
        select: {
          id: true,
          slug: true,
          title: true,
          _count: { select: { answers: { where: { status: "PUBLISHED" } } } },
        },
      });
      return questions.map((question) => ({
        id: question.id,
        slug: question.slug,
        title: question.title,
        answerCount: question._count.answers,
      }));
    }
    case "users": {
      const users = await prisma.user.findMany({
        where: { status: "ACTIVE", id: { in: ids } },
        select: {
          ...safePublicUserSelect,
          degree: true,
          country: { select: { emoji: true } },
          university: { select: { shortName: true } },
        },
      });
      return users.map((user) => ({
        ...toSafePublicUser(user),
        countryEmoji: user.country?.emoji ?? null,
        affiliation: user.university?.shortName ?? user.degree ?? null,
      }));
    }
    case "posts": {
      const posts = await prisma.post.findMany({
        where: {
          AND: [
            publishedPostVisibilityWhere({ id: userId }),
            { author: { status: "ACTIVE" } },
            { id: { in: ids } },
          ],
        },
        select: {
          id: true,
          title: true,
          content: true,
          community: { select: { slug: true, name: true } },
          author: { select: safePublicUserSelect },
        },
      });
      return posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        community: post.community,
        author: toSafePublicUser(post.author),
      }));
    }
  }
}
