import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { activeListingWhere } from "@/lib/content-visibility";
import {
  assessListingFraud,
  createMarketplaceListing,
  createOrReuseListingReport,
  deleteMarketplaceCategory,
  expireMarketplaceListings,
  getAdminListing,
  listAdminListings,
  listSellerListings,
  transitionMarketplaceListing,
  updateListingAsAdmin,
  updateMarketplaceListing,
  upsertMarketplaceCategory,
} from "@/lib/marketplace";
import { getReportDetail } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module12.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  await prisma.$executeRawUnsafe(
    'DROP TRIGGER IF EXISTS "module12_fail_audit_trigger" ON "AuditLog"',
  );
  await prisma.$executeRawUnsafe(
    'DROP FUNCTION IF EXISTS "module12_fail_audit"()',
  );
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const listings = await prisma.marketplaceListing.findMany({
    where: { sellerId: { in: userIds } },
    select: { id: true, categoryId: true, cityId: true },
  });
  const listingIds = listings.map(({ id }) => id);
  const reports = await prisma.report.findMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { subjectUserId: { in: userIds } },
        { targetType: "MarketplaceListing", targetId: { in: listingIds } },
      ],
    },
    select: { id: true },
  });
  const reportIds = reports.map(({ id }) => id);
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: {
      OR: [
        { recipientId: { in: userIds } },
        { actorId: { in: userIds } },
      ],
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        {
          entityType: "MarketplaceListing",
          entityId: { in: listingIds },
        },
        { entityType: "Report", entityId: { in: reportIds } },
      ],
    },
  });
  await prisma.marketplaceListing.deleteMany({
    where: { id: { in: listingIds } },
  });
  await prisma.mediaAsset.deleteMany({
    where: { ownerId: { in: userIds } },
  });
  await prisma.marketplaceCategory.deleteMany({
    where: {
      OR: [
        { id: { in: listings.map(({ categoryId }) => categoryId) } },
        { name: { startsWith: "Module 12" } },
        { name: { startsWith: "Unused " } },
      ],
    },
  });
  await prisma.city.deleteMany({
    where: {
      OR: [
        { id: { in: listings.map(({ cityId }) => cityId) } },
        { name: { startsWith: "Module 12" } },
      ],
    },
  });
  await prisma.country.deleteMany({
    where: { name: { startsWith: "Module 12" } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [seller, buyer, stranger, moderator, admin] = await Promise.all(
    [
      ["seller", "MEMBER"],
      ["buyer", "MEMBER"],
      ["stranger", "MEMBER"],
      ["moderator", "MODERATOR"],
      ["admin", "ADMIN"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          username: `${label}${suffix.slice(0, 8)}`,
          firstName: label![0]!.toUpperCase() + label!.slice(1),
          lastName: "Marketplace",
          role: role as "MEMBER" | "MODERATOR" | "ADMIN",
          status: "ACTIVE",
        },
      }),
    ),
  );
  const country = await prisma.country.create({
    data: {
      code: `Q${suffix.slice(0, 1).toUpperCase()}`,
      name: `Module 12 Country ${suffix}`,
      isActive: true,
      verified: true,
    },
  });
  const city = await prisma.city.create({
    data: {
      slug: `module-12-city-${suffix}`,
      name: `Module 12 City ${suffix}`,
      countryId: country.id,
      isActive: true,
      verified: true,
    },
  });
  const category = await prisma.marketplaceCategory.create({
    data: {
      slug: `module-12-category-${suffix}`,
      name: `Module 12 Category ${suffix}`,
      description: "A managed Marketplace integration category.",
      isActive: true,
    },
  });
  return {
    seller,
    buyer,
    stranger,
    moderator,
    admin,
    country,
    city,
    category,
  };
}

async function createListingImage(ownerId = fixture.seller.id) {
  const suffix = randomUUID().replaceAll("-", "");
  return prisma.mediaAsset.create({
    data: {
      ownerId,
      objectKey: `media/${ownerId}/listing-image/${suffix}.jpg`,
      storageProvider: "LOCAL",
      kind: "IMAGE",
      purpose: "LISTING_IMAGE",
      visibility: "PUBLIC",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "marketplace.jpg",
      extension: "jpg",
      declaredMime: "image/jpeg",
      detectedMime: "image/jpeg",
      sizeBytes: 4096,
      width: 800,
      height: 600,
      altText: "Marketplace item in Jiaxing",
      checksumSha256: "c".repeat(64),
      uploadExpiresAt: new Date(Date.now() + 60_000),
      uploadedAt: new Date(),
      validatedAt: new Date(),
    },
  });
}

async function createListing(input: {
  publish?: boolean;
  image?: boolean;
  title?: string;
  description?: string;
  priceFen?: number;
} = {}) {
  const media =
    input.image === false ? null : await createListingImage(fixture.seller.id);
  const result = await createMarketplaceListing({
    actor: fixture.seller,
    data: {
      categoryId: fixture.category.id,
      cityId: fixture.city.id,
      title: input.title ?? `Desk lamp ${randomUUID().slice(0, 8)}`,
      description:
        input.description ??
        "A clean student item available for local collection in Jiaxing.",
      priceFen: input.priceFen ?? 5_000,
      isNegotiable: true,
      imageIds: media ? [media.id] : [],
      publish: input.publish ?? true,
      expiresInDays: 30,
    },
  });
  return { ...result, media };
}

postgresDescribe("Module 12 PostgreSQL Marketplace", () => {
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

  it("creates and edits safe listings while holding high-risk content for review", async () => {
    const safe = await createListing();
    expect(safe.listing).toMatchObject({
      status: "ACTIVE",
      sellerId: fixture.seller.id,
      images: [{ mediaId: safe.media!.id }],
    });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: safe.media!.id },
        select: { attachmentType: true, attachmentId: true },
      }),
    ).resolves.toEqual({
      attachmentType: "MARKETPLACE_LISTING",
      attachmentId: safe.listing.id,
    });
    await expect(
      updateMarketplaceListing({
        actor: fixture.stranger,
        listingId: safe.listing.id,
        data: { title: "Unauthorized edit" },
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateMarketplaceListing({
        actor: fixture.seller,
        listingId: safe.listing.id,
        data: { imageIds: [] },
      }),
    ).rejects.toMatchObject({ status: 409 });

    const risky = await createListing({
      description:
        "Urgent: pay first with USDT or a gift card using this external link today only.",
    });
    expect(risky.requiresReview).toBe(true);
    expect(risky.listing.status).toBe("DRAFT");
    await expect(
      prisma.marketplaceListing.findUniqueOrThrow({
        where: { id: risky.listing.id },
        select: { fraudScore: true, fraudFlags: true },
      }),
    ).resolves.toMatchObject({
      fraudScore: 100,
      fraudFlags: expect.arrayContaining([
        "ADVANCE_PAYMENT",
        "IRREVERSIBLE_PAYMENT",
        "PRESSURE_LANGUAGE",
      ]),
    });
    expect(
      assessListingFraud({
        title: "Ordinary lamp",
        description: "Collection on campus after inspection.",
        priceFen: 5_000,
      }),
    ).toEqual({ score: 0, flags: [] });
  });

  it("enforces the seller lifecycle and queues status notifications for saved listings", async () => {
    const draft = await createListing({ publish: false });
    await transitionMarketplaceListing({
      actor: fixture.seller,
      listingId: draft.listing.id,
      status: "ACTIVE",
      expiresInDays: 14,
    });
    await prisma.listingFavorite.create({
      data: { listingId: draft.listing.id, userId: fixture.buyer.id },
    });
    await transitionMarketplaceListing({
      actor: fixture.seller,
      listingId: draft.listing.id,
      status: "RESERVED",
    });
    await expect(
      transitionMarketplaceListing({
        actor: fixture.seller,
        listingId: draft.listing.id,
        status: "DRAFT",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await transitionMarketplaceListing({
      actor: fixture.seller,
      listingId: draft.listing.id,
      status: "SOLD",
    });
    await expect(
      prisma.notificationJob.count({
        where: {
          recipientId: fixture.buyer.id,
          type: "MARKETPLACE_UPDATE",
        },
      }),
    ).resolves.toBe(2);

    const imageLess = await createListing({ publish: false, image: false });
    await expect(
      transitionMarketplaceListing({
        actor: fixture.seller,
        listingId: imageLess.listing.id,
        status: "ACTIVE",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("expires listings idempotently and removes them from shared visibility", async () => {
    const active = await createListing();
    const expiredAt = new Date(Date.now() - 60_000);
    await prisma.marketplaceListing.update({
      where: { id: active.listing.id },
      data: { expiresAt: expiredAt },
    });
    await expect(expireMarketplaceListings()).resolves.toEqual({
      examined: 1,
      expired: 1,
    });
    await expect(expireMarketplaceListings()).resolves.toEqual({
      examined: 0,
      expired: 0,
    });
    await expect(
      prisma.marketplaceListing.findFirst({
        where: { id: active.listing.id, ...activeListingWhere() },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.notificationJob.count({
        where: {
          recipientId: fixture.seller.id,
          dedupeKey: `listing-expired:${active.listing.id}`,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditLog.count({
        where: {
          action: "LISTING_EXPIRED",
          entityId: active.listing.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it("reuses concurrent reports, retains evidence, and redacts it by role", async () => {
    const active = await createListing();
    const results = await Promise.all([
      createOrReuseListingReport({
        actor: fixture.buyer,
        listingId: active.listing.id,
        reason: "SCAM",
        details: "The seller requested an unsafe payment method.",
      }),
      createOrReuseListingReport({
        actor: fixture.buyer,
        listingId: active.listing.id,
        reason: "SCAM",
        details: "The seller requested an unsafe payment method.",
      }),
    ]);
    expect(new Set(results.map(({ reportId }) => reportId)).size).toBe(1);
    await expect(
      prisma.report.count({
        where: {
          reporterId: fixture.buyer.id,
          targetType: "MarketplaceListing",
          targetId: active.listing.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: active.media!.id },
        select: { retainedAt: true },
      }),
    ).resolves.toMatchObject({ retainedAt: expect.any(Date) });

    const moderator = await getReportDetail(
      fixture.moderator,
      results[0]!.reportId,
    );
    const admin = await getReportDetail(fixture.admin, results[0]!.reportId);
    expect(moderator?.evidence[0]?.content).toMatchObject({
      authorName: "Reported member",
      authorUsername: null,
      mediaIds: [],
      priceFen: 5_000,
    });
    expect(admin?.evidence[0]?.content).toMatchObject({
      authorName: `${fixture.seller.firstName} ${fixture.seller.lastName}`,
      authorUsername: fixture.seller.username,
      mediaIds: [active.media!.id],
    });
  });

  it("separates Marketplace CMS permissions and protects category dependencies", async () => {
    const active = await createListing();
    await expect(
      listAdminListings(fixture.moderator),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateListingAsAdmin({
        actor: fixture.moderator,
        listingId: active.listing.id,
        status: "REMOVED",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const dashboard = await listAdminListings(fixture.admin, {
      query: active.listing.title,
      pageSize: 5,
    });
    expect(dashboard).toMatchObject({ page: 1, pageSize: 5, total: 1 });
    expect(dashboard.records[0]).not.toHaveProperty("sellerId");
    await updateListingAsAdmin({
      actor: fixture.admin,
      listingId: active.listing.id,
      status: "REMOVED",
      moderationNote: "Removed after a documented Marketplace safety review.",
    });
    await expect(
      getAdminListing(fixture.admin, active.listing.id),
    ).resolves.toMatchObject({ status: "REMOVED" });
    await expect(
      deleteMarketplaceCategory({
        actor: fixture.admin,
        categoryId: fixture.category.id,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const created = await upsertMarketplaceCategory({
      actor: fixture.admin,
      data: {
        slug: `unused-${randomUUID().slice(0, 8)}`,
        name: `Unused ${randomUUID().slice(0, 8)}`,
        description: null,
        icon: null,
        order: 10,
        isActive: true,
      },
    });
    await deleteMarketplaceCategory({
      actor: fixture.admin,
      categoryId: created.category.id,
    });
    await expect(
      prisma.marketplaceCategory.findUnique({
        where: { id: created.category.id },
      }),
    ).resolves.toBeNull();
  });

  it("paginates the seller dashboard and supports current public filters", async () => {
    await createListing({ title: "Affordable green desk", priceFen: 2_500 });
    await createListing({ title: "Premium desk chair", priceFen: 12_500 });
    const seller = await listSellerListings(fixture.seller, {
      page: 1,
      pageSize: 5,
      status: "ACTIVE",
    });
    expect(seller).toMatchObject({
      page: 1,
      pageSize: 5,
      total: 2,
      pageCount: 1,
    });
    const filtered = await prisma.marketplaceListing.findMany({
      where: {
        ...activeListingWhere(),
        cityId: fixture.city.id,
        categoryId: fixture.category.id,
        priceFen: { lte: 5_000 },
      },
      orderBy: { priceFen: "asc" },
      select: { title: true, priceFen: true },
    });
    expect(filtered).toEqual([
      { title: "Affordable green desk", priceFen: 2_500 },
    ]);
  });

  it("rolls back listing edits when the mandatory audit write fails", async () => {
    const active = await createListing({ title: "Atomic listing" });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module12_fail_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" = 'LISTING_UPDATED' THEN
          RAISE EXCEPTION 'module12 forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module12_fail_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module12_fail_audit"()
    `);
    await expect(
      updateMarketplaceListing({
        actor: fixture.seller,
        listingId: active.listing.id,
        data: { title: "This edit must roll back" },
      }),
    ).rejects.toThrow(/forced audit failure/);
    await expect(
      prisma.marketplaceListing.findUniqueOrThrow({
        where: { id: active.listing.id },
        select: { title: true },
      }),
    ).resolves.toEqual({ title: "Atomic listing" });
  });
});
