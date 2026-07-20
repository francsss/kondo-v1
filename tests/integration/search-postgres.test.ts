import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { searchCategory, searchKondo } from "@/lib/search";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module13.test";
const token = "zyxwavq"; // distinctive token unlikely to collide with other fixtures

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.marketplaceListing.deleteMany({
    where: { sellerId: { in: userIds } },
  });
  await prisma.post.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.community.deleteMany({
    where: { createdById: { in: userIds } },
  });
  await prisma.question.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.guide.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.marketplaceCategory.deleteMany({
    where: { name: { startsWith: "Module 13" } },
  });
  await prisma.city.deleteMany({
    where: { name: { startsWith: "Module 13" } },
  });
  await prisma.country.deleteMany({
    where: { name: { startsWith: "Module 13" } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [viewer, member, author] = await Promise.all(
    [
      ["viewer", "MEMBER"],
      ["member", "MEMBER"],
      ["author", "MEMBER"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          username: `${label}${suffix.slice(0, 8)}`,
          firstName: label![0]!.toUpperCase() + label!.slice(1),
          lastName: "Search",
          role: role as "MEMBER",
          status: "ACTIVE",
        },
      }),
    ),
  );
  const country = await prisma.country.create({
    data: {
      code: `S${suffix.slice(0, 1).toUpperCase()}`,
      name: `Module 13 Country ${suffix}`,
      isActive: true,
      verified: true,
    },
  });
  const city = await prisma.city.create({
    data: {
      slug: `module-13-city-${suffix}`,
      name: `Module 13 City ${suffix}`,
      countryId: country.id,
      isActive: true,
      verified: true,
    },
  });
  const category = await prisma.marketplaceCategory.create({
    data: {
      slug: `module-13-category-${suffix}`,
      name: `Module 13 Category ${suffix}`,
      isActive: true,
    },
  });
  return { viewer, member, author, country, city, category };
}

async function createListing(input: {
  title: string;
  status?: "ACTIVE" | "DRAFT";
}) {
  return prisma.marketplaceListing.create({
    data: {
      slug: `module13-${randomUUID().slice(0, 8)}`,
      sellerId: fixture.author.id,
      categoryId: fixture.category.id,
      cityId: fixture.city.id,
      title: input.title,
      description: "A search fixture listing for Module 13 coverage.",
      priceFen: 1000,
      status: input.status ?? "ACTIVE",
      publishedAt: input.status !== "DRAFT" ? new Date() : null,
      expiresAt:
        input.status !== "DRAFT"
          ? new Date(Date.now() + 30 * 86_400_000)
          : null,
    },
  });
}

postgresDescribe("Module 13 PostgreSQL full-text search", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  beforeEach(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("matches full-text tokens and ranks title matches above body-only matches", async () => {
    const titleMatch = await createListing({
      title: `Vintage ${token} bicycle`,
    });
    const bodyOnlyMatch = await prisma.marketplaceListing.create({
      data: {
        slug: `module13-${randomUUID().slice(0, 8)}`,
        sellerId: fixture.author.id,
        categoryId: fixture.category.id,
        cityId: fixture.city.id,
        title: "Unrelated desk",
        description: `Mentions ${token} only in the body text.`,
        priceFen: 1500,
        status: "ACTIVE",
        publishedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });

    const results = await searchKondo(token, fixture.viewer.id);
    const ids = results.listings.map((listing) => listing.id);
    expect(ids).toEqual([titleMatch.id, bodyOnlyMatch.id]);
  });

  it("excludes listings whose lifecycle state is not active", async () => {
    await createListing({ title: `${token} draft item`, status: "DRAFT" });
    const active = await createListing({ title: `${token} active item` });

    const results = await searchKondo(token, fixture.viewer.id);
    expect(results.listings.map((listing) => listing.id)).toEqual([active.id]);
  });

  it("hides a private community's posts from a non-member and shows them to a member", async () => {
    const community = await prisma.community.create({
      data: {
        slug: `module13-private-${randomUUID().slice(0, 8)}`,
        name: `Module 13 Private ${token}`,
        description: "Private community search fixture.",
        type: "TOPIC",
        status: "ACTIVE",
        isPrivate: true,
        createdById: fixture.author.id,
        ownerId: fixture.author.id,
        members: {
          create: [
            { userId: fixture.author.id, role: "OWNER" },
            { userId: fixture.member.id, role: "MEMBER" },
          ],
        },
      },
    });
    await prisma.post.create({
      data: {
        communityId: community.id,
        authorId: fixture.author.id,
        title: `${token} private discussion`,
        content: "Only members should find this post through search.",
        status: "PUBLISHED",
      },
    });

    const nonMemberResults = await searchKondo(token, fixture.viewer.id);
    expect(nonMemberResults.posts).toHaveLength(0);
    expect(nonMemberResults.communities).toHaveLength(0);

    const memberResults = await searchKondo(token, fixture.member.id);
    expect(memberResults.posts).toHaveLength(1);
    expect(memberResults.communities).toHaveLength(1);
  });

  it("paginates a single category by cursor without skipping or repeating results", async () => {
    const listings = [];
    for (let index = 0; index < 12; index += 1) {
      listings.push(await createListing({ title: `${token} item ${index}` }));
    }

    const seen = new Set<string>();
    let cursor: string | undefined;
    let pages = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const page = await searchCategory("listings", token, fixture.viewer.id, {
        cursor,
        limit: 5,
      });
      pages += 1;
      expect(page.items.length).toBeLessThanOrEqual(5);
      for (const item of page.items) {
        expect(seen.has(item.id)).toBe(false);
        seen.add(item.id);
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    expect(seen.size).toBe(listings.length);
    expect(pages).toBe(3);
  });

  it("rejects an out-of-range search term", async () => {
    await expect(
      searchCategory("listings", "a", fixture.viewer.id, {}),
    ).rejects.toMatchObject({ status: 400 });
  });
});
