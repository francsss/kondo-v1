import { Prisma } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedGuideWhere,
  publishedPostVisibilityWhere,
  publishedQuestionWhere,
} from "@/lib/content-visibility";
import { organizationTypeLabel } from "@/features/organizations/registry";
import { organizationPublicVisibilityWhere } from "@/lib/organization-public-visibility";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
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
  "organizations",
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
  organizations: Prisma.sql`"Organization"`,
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
  organizations: Prisma.sql`AND "lifecycleStatus" = 'ACTIVE' AND "publicProfileStatus" = 'PUBLISHED' AND "publicProfileBlockedAt" IS NULL`,
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
  organizations: false,
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
  if (category === "organizations") {
    const publicContext = Prisma.sql`
      to_tsvector(
        'simple',
        concat_ws(
          ' ',
          "Organization"."type"::text,
          array_to_string("Organization"."supportedLanguages", ' '),
          coalesce(city."name", ''),
          coalesce(country."name", ''),
          coalesce(
            (
              SELECT string_agg(capability."key"::text, ' ')
              FROM "OrganizationCapability" capability
              WHERE capability."organizationId" = "Organization"."id"
                AND capability."status" = 'ENABLED'
            ),
            ''
          )
        )
      )
    `;
    const organizationRank = Prisma.sql`
      (
        ts_rank(
          "Organization"."searchVector",
          websearch_to_tsquery('simple', ${term})
        )::float8
        + ts_rank(
          ${publicContext},
          websearch_to_tsquery('simple', ${term})
        )::float8
        + CASE
            WHEN lower("Organization"."publicName") = lower(${term}) THEN 2.0
            WHEN lower("Organization"."publicName") LIKE lower(${`${term}%`})
              THEN 0.5
            ELSE 0.0
          END
      )
    `;
    const organizationCursor = cursor
      ? Prisma.sql`AND (${organizationRank}, "Organization"."id") < (${cursor.rank}::float8, ${cursor.id})`
      : Prisma.empty;
    return prisma.$queryRaw<RankedRow[]>(Prisma.sql`
      SELECT
        "Organization"."id",
        ${organizationRank} AS "rank"
      FROM "Organization"
      INNER JOIN "Country" country
        ON country."id" = "Organization"."countryId"
      LEFT JOIN "City" city
        ON city."id" = "Organization"."cityId"
      WHERE "Organization"."lifecycleStatus" = 'ACTIVE'
        AND "Organization"."publicProfileStatus" = 'PUBLISHED'
        AND "Organization"."publicProfileBlockedAt" IS NULL
        AND (
          "Organization"."searchVector"
            @@ websearch_to_tsquery('simple', ${term})
          OR ${publicContext} @@ websearch_to_tsquery('simple', ${term})
          OR lower("Organization"."publicName") LIKE lower(${`%${term}%`})
        )
        ${organizationCursor}
      ORDER BY "rank" DESC, "Organization"."id" DESC
      LIMIT ${limit}
    `);
  }
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
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
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
      organizations: [],
      communities: [],
      listings: [],
      guides: [],
      questions: [],
      users: [],
      posts: [],
      universities: [],
      countries: [],
      cities: [],
      opportunities: [],
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
    organizationRanks,
  ] = await Promise.all([
    rankedIds("communities", term, overfetchLimit),
    rankedIds("listings", term, previewLimit),
    rankedIds("guides", term, previewLimit),
    rankedIds("questions", term, previewLimit),
    rankedIds("users", term, previewLimit),
    rankedIds("posts", term, overfetchLimit),
    rankedIds("organizations", term, previewLimit),
  ]);

  const [
    communities,
    listings,
    guides,
    questions,
    users,
    posts,
    organizations,
    universities,
    countries,
    cities,
    legacyScholarships,
    unifiedOpportunities,
  ] = await Promise.all([
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
        isOfficial: true,
        isVerified: true,
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
    prisma.organization.findMany({
      where: {
        ...organizationPublicVisibilityWhere,
        id: { in: organizationRanks.map((row) => row.id) },
      },
      select: {
        id: true,
        slug: true,
        publicName: true,
        type: true,
        shortDescription: true,
        verificationStatus: true,
        isOfficialPartner: true,
        city: { select: { name: true } },
        country: { select: { name: true } },
      },
    }),
    prisma.university.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { shortName: { contains: term, mode: "insensitive" } },
          { city: { name: { contains: term, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ verified: "desc" }, { name: "asc" }],
      take: previewLimit,
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        city: { select: { name: true } },
      },
    }),
    prisma.country.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { code: { equals: term, mode: "insensitive" } },
        ],
      },
      orderBy: { name: "asc" },
      take: previewLimit,
      select: { id: true, code: true, name: true, emoji: true },
    }),
    prisma.city.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { province: { contains: term, mode: "insensitive" } },
        ],
      },
      orderBy: [{ verified: "desc" }, { name: "asc" }],
      take: previewLimit,
      select: { id: true, slug: true, name: true, province: true },
    }),
    prisma.scholarship.findMany({
      where: {
        isActive: true,
        status: { in: ["OPEN", "OPENING_SOON"] },
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { provider: { contains: term, mode: "insensitive" } },
          { city: { contains: term, mode: "insensitive" } },
          { fields: { has: term } },
        ],
      },
      orderBy: [{ isFeatured: "desc" }, { deadline: "asc" }],
      take: previewLimit,
      select: {
        id: true,
        slug: true,
        title: true,
        provider: true,
        status: true,
      },
    }),
    // Unified opportunities. Only publicly eligible records are searched, and
    // only public columns: applicant data, answers, documents, internal notes,
    // reviewer assignments and private eligibility never take part.
    prisma.opportunity.findMany({
      where: {
        ...publicOpportunityWhere(),
        OR: [
          { title: { contains: term, mode: "insensitive" } },
          { shortDescription: { contains: term, mode: "insensitive" } },
          { locationLabel: { contains: term, mode: "insensitive" } },
          {
            publisherOrganization: {
              publicName: { contains: term, mode: "insensitive" },
            },
          },
        ],
      },
      orderBy: [
        { applicationDeadline: { sort: "asc", nulls: "last" } },
        { publishedAt: "desc" },
        { id: "asc" },
      ],
      take: previewLimit,
      select: {
        id: true,
        slug: true,
        title: true,
        legacySourceKey: true,
        publisherOrganization: { select: { publicName: true } },
      },
    }),
  ]);

  // Legacy scholarships already migrated into a unified Opportunity carry the
  // matching legacySourceKey; those rows are suppressed below.
  const claimedLegacyKeys = new Set(
    unifiedOpportunities.flatMap((opportunity) =>
      opportunity.legacySourceKey ? [opportunity.legacySourceKey] : [],
    ),
  );

  return {
    organizations: orderByRank(organizations, organizationRanks).map(
      (organization) => ({
        id: organization.id,
        slug: organization.slug,
        name: organization.publicName,
        organizationType: organization.type,
        organizationTypeLabel: organizationTypeLabel(organization.type),
        shortDescription: organization.shortDescription,
        cityName: organization.city?.name ?? null,
        countryName: organization.country.name,
        verificationState:
          organization.verificationStatus === "VERIFIED"
            ? ("VERIFIED" as const)
            : ("UNVERIFIED" as const),
        partner:
          organization.verificationStatus === "VERIFIED" &&
          organization.isOfficialPartner,
      }),
    ),
    communities: orderByRank(communities, communityRanks)
      .slice(0, previewLimit)
      .map((community) => ({
        id: community.id,
        slug: community.slug,
        name: community.name,
        icon: community.icon,
        memberCount: community._count.members,
        isOfficial: community.isOfficial,
        isVerified: community.isVerified,
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
    universities: universities.map((university) => ({
      id: university.id,
      slug: university.slug,
      name: university.name,
      shortName: university.shortName,
      cityName: university.city.name,
    })),
    countries,
    cities,
    // Unified records first, then legacy scholarships that no unified record
    // already represents, so one source never appears twice.
    opportunities: [
      ...unifiedOpportunities.map((opportunity) => ({
        id: opportunity.id,
        slug: opportunity.slug,
        title: opportunity.title,
        provider: opportunity.publisherOrganization?.publicName ?? "Kondo",
        status: "OPEN",
      })),
      ...legacyScholarships.filter(
        (scholarship) =>
          !claimedLegacyKeys.has(`legacy-scholarship:${scholarship.id}`),
      ),
    ].slice(0, previewLimit),
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
    cursor = {
      rank: ranked[ranked.length - 1]!.rank,
      id: ranked[ranked.length - 1]!.id,
    };
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
    case "organizations": {
      const organizations = await prisma.organization.findMany({
        where: {
          ...organizationPublicVisibilityWhere,
          id: { in: ids },
        },
        select: {
          id: true,
          slug: true,
          publicName: true,
          type: true,
          shortDescription: true,
          verificationStatus: true,
          isOfficialPartner: true,
          city: { select: { name: true } },
          country: { select: { name: true } },
        },
      });
      return organizations.map((organization) => ({
        id: organization.id,
        slug: organization.slug,
        name: organization.publicName,
        organizationType: organization.type,
        organizationTypeLabel: organizationTypeLabel(organization.type),
        shortDescription: organization.shortDescription,
        cityName: organization.city?.name ?? null,
        countryName: organization.country.name,
        verificationState:
          organization.verificationStatus === "VERIFIED"
            ? "VERIFIED"
            : "UNVERIFIED",
        partner:
          organization.verificationStatus === "VERIFIED" &&
          organization.isOfficialPartner,
      }));
    }
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
          isOfficial: true,
          isVerified: true,
          _count: { select: { members: true } },
        },
      });
      return communities.map((community) => ({
        id: community.id,
        slug: community.slug,
        name: community.name,
        icon: community.icon,
        memberCount: community._count.members,
        isOfficial: community.isOfficial,
        isVerified: community.isVerified,
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
