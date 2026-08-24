import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getMediaForDelivery } from "@/lib/media";
import { prisma } from "@/lib/prisma";

/**
 * Who can actually load the picture on a product.
 *
 * A restaurant would upload a photo of a dish, see it on its own screen,
 * publish the item, and every student would get a 404 where the picture
 * should be. Nothing failed loudly: the asset was stored, attached, and
 * returned in the API payload as `/api/media/<id>` — only the bytes were
 * refused, because catalog images are PRIVATE and delivery had no rule that
 * ever made a published item's image readable by anyone but its uploader.
 *
 * These run against real Postgres rather than a mocked client on purpose. The
 * defect was in a `where` clause; a mock would have been written to match
 * whatever the code did and would have agreed with the bug.
 */

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;

const testDomain = "catalogmedia.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const organizations = await prisma.organization.findMany({
    where: { createdById: { in: userIds } },
    select: { id: true },
  });
  const organizationIds = organizations.map(({ id }) => id);

  await prisma.organizationProductMedia.deleteMany({
    where: { product: { organizationId: { in: organizationIds } } },
  });
  await prisma.organizationServiceMedia.deleteMany({
    where: { service: { organizationId: { in: organizationIds } } },
  });
  await prisma.organizationProduct.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.organizationService.deleteMany({
    where: { organizationId: { in: organizationIds } },
  });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: userIds } },
  });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: userIds } } });
  // Memberships and capabilities go with the organization. Deleting a
  // membership on its own trips the "exactly one active owner" trigger.
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const country = await prisma.country.findFirstOrThrow({
    select: { id: true },
  });

  const owner = await prisma.user.create({
    data: {
      email: `owner-${suffix}@${testDomain}`,
      firstName: "Catalog",
      lastName: "Owner",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const student = await prisma.user.create({
    data: {
      email: `student-${suffix}@${testDomain}`,
      firstName: "Catalog",
      lastName: "Student",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  const organization = await prisma.organization.create({
    data: {
      publicName: "Test Canteen",
      slug: `test-canteen-${suffix}`,
      type: "COMPANY",
      countryId: country.id,
      createdById: owner.id,
      lifecycleStatus: "ACTIVE",
      publicProfileStatus: "PUBLISHED",
      memberships: {
        create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
      },
      capabilities: { create: { key: "PRODUCTS", status: "ENABLED" } },
    },
  });

  const product = await prisma.organizationProduct.create({
    data: {
      slug: `braised-pork-${suffix}`,
      organizationId: organization.id,
      createdByUserId: owner.id,
      title: "Braised pork rice",
      shortDescription: "The canteen's most ordered dish.",
      description: "Slow-braised pork belly over rice.",
      category: "Food",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  // An asset in exactly the state a completed upload leaves behind.
  const asset = await prisma.mediaAsset.create({
    data: {
      ownerId: owner.id,
      objectKey: `organizations/${organization.id}/products/${suffix}.jpg`,
      storageProvider: "LOCAL",
      kind: "IMAGE",
      purpose: "ORGANIZATION_PRODUCT_IMAGE",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "dish.jpg",
      extension: "jpg",
      declaredMime: "image/jpeg",
      detectedMime: "image/jpeg",
      sizeBytes: 2048,
      // The schema refuses an ACTIVE asset without these; a completed upload
      // always has them.
      checksumSha256: "a".repeat(64),
      width: 1024,
      height: 768,
      uploadExpiresAt: new Date(Date.now() + 3_600_000),
      uploadedAt: new Date(),
      validatedAt: new Date(),
      attachedAt: new Date(),
      attachmentType: "ORGANIZATION_PRODUCT",
      attachmentId: product.id,
    },
  });

  await prisma.organizationProductMedia.create({
    data: {
      productId: product.id,
      mediaId: asset.id,
      kind: "COVER",
      altText: "A bowl of braised pork rice",
      sortOrder: 0,
    },
  });

  return { owner, student, organization, product, asset };
}

const asActor = (user: { id: string; role: string }) => ({
  id: user.id,
  role: user.role as never,
});

postgresDescribe("organization catalog media delivery", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("serves a published product's image to a signed-in student", async () => {
    const asset = await getMediaForDelivery(
      fixture.asset.id,
      asActor(fixture.student),
    );
    expect(asset.id).toBe(fixture.asset.id);
    // Upgraded to PUBLIC so the response can be cached like other public media.
    expect(asset.visibility).toBe("PUBLIC");
  });

  it("serves it to a signed-out visitor as well", async () => {
    const asset = await getMediaForDelivery(fixture.asset.id, null);
    expect(asset.id).toBe(fixture.asset.id);
  });

  it("still serves it to the organization's own staff", async () => {
    const asset = await getMediaForDelivery(
      fixture.asset.id,
      asActor(fixture.owner),
    );
    expect(asset.id).toBe(fixture.asset.id);
  });

  it("hides a draft item's image from everyone outside the organization", async () => {
    await prisma.organizationProduct.update({
      where: { id: fixture.product.id },
      data: { status: "DRAFT", publishedAt: null },
    });
    try {
      await expect(
        getMediaForDelivery(fixture.asset.id, asActor(fixture.student)),
      ).rejects.toMatchObject({ status: 404 });
      await expect(getMediaForDelivery(fixture.asset.id, null)).rejects.toThrow();
      // The people working on the draft can still see what they uploaded.
      const staffView = await getMediaForDelivery(
        fixture.asset.id,
        asActor(fixture.owner),
      );
      expect(staffView.id).toBe(fixture.asset.id);
    } finally {
      await prisma.organizationProduct.update({
        where: { id: fixture.product.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      });
    }
  });

  it("hides it again when the organization's public profile is withdrawn", async () => {
    await prisma.organization.update({
      where: { id: fixture.organization.id },
      data: { publicProfileStatus: "UNPUBLISHED" },
    });
    try {
      await expect(
        getMediaForDelivery(fixture.asset.id, asActor(fixture.student)),
      ).rejects.toMatchObject({ status: 404 });
    } finally {
      await prisma.organization.update({
        where: { id: fixture.organization.id },
        data: { publicProfileStatus: "PUBLISHED" },
      });
    }
  });
});
