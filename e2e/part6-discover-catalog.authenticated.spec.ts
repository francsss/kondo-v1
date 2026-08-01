import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const disposable =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const email = process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const token = randomUUID().replaceAll("-", "").slice(0, 10);
const organizationSlug = `e2e-catalog-${token}`;
const productSlug = `arrival-kit-${token}`;
const serviceSlug = `airport-welcome-${token}`;
const productTitle = `Arrival starter kit ${token}`;
const serviceTitle = `Airport welcome service ${token}`;
let organizationId = "";
let citySlug = "";
let communitySlug = "";
const uploadedMediaIds: string[] = [];

test.describe.serial("Part 6 Discover and professional catalog", () => {
  test.skip(!disposable, "Requires the disposable PostgreSQL test database.");

  test.beforeAll(async () => {
    const [owner, city, community] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      }),
      prisma.city.findFirstOrThrow({
        where: { isActive: true },
        select: { id: true, slug: true, countryId: true },
      }),
      prisma.community.findFirstOrThrow({
        where: { status: "ACTIVE", isPrivate: false },
        select: { slug: true },
      }),
    ]);
    citySlug = city.slug;
    communitySlug = community.slug;
    const organization = await prisma.organization.create({
      data: {
        slug: organizationSlug,
        publicName: `E2E Essentials ${token}`,
        legalName: `E2E Essentials ${token} Ltd`,
        type: "SERVICE_PROVIDER",
        countryId: city.countryId,
        cityId: city.id,
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        publishedAt: new Date(),
        setupCompletedAt: new Date(),
        createdById: owner.id,
        shortDescription:
          "A disposable professional catalog used for end-to-end validation.",
        memberships: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
        capabilities: {
          create: [
            { key: "PRODUCTS", status: "ENABLED" },
            { key: "STUDENT_SERVICES", status: "ENABLED" },
          ],
        },
        products: {
          create: {
            slug: productSlug,
            createdByUserId: owner.id,
            cityId: city.id,
            title: productTitle,
            shortDescription:
              "A real disposable arrival kit for testing public discovery.",
            description:
              "This disposable product validates professional catalog visibility without creating Marketplace data.",
            category: "Arrival",
            status: "PUBLISHED",
            priceType: "FIXED",
            priceMinor: 12900,
            currency: "CNY",
            contactMethod: "KONDO_MESSAGE",
            publishedAt: new Date(),
          },
        },
        services: {
          create: {
            slug: serviceSlug,
            createdByUserId: owner.id,
            cityId: city.id,
            title: serviceTitle,
            shortDescription:
              "A real disposable welcome service for testing public discovery.",
            description:
              "This disposable service validates safe organization inquiries and source-owned discovery projections.",
            category: "Arrival",
            status: "PUBLISHED",
            priceType: "CONTACT",
            currency: "CNY",
            contactMethod: "KONDO_MESSAGE",
            publishedAt: new Date(),
          },
        },
      },
      select: { id: true },
    });
    organizationId = organization.id;
  });

  test.afterAll(async () => {
    if (uploadedMediaIds.length > 0) {
      await prisma.mediaAsset.deleteMany({
        where: { id: { in: uploadedMediaIds } },
      });
    }
    if (organizationId) {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await prisma.$disconnect();
  });

  test("discovers source-owned catalog records and keeps Marketplace separate", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/discover?type=products&q=${token}`);
    await expect(page.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      page.getByRole("heading", { name: productTitle }),
    ).toBeVisible();
    await page.getByRole("heading", { name: productTitle }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${productSlug}$`));
    await expect(page.getByRole("button", { name: /save/i })).toBeVisible();

    await page.goto(`/marketplace?q=${encodeURIComponent(token)}`);
    await expect(page.getByText(productTitle)).toHaveCount(0);
  });

  test("projects catalog into City Hub and page-like organization sections", async ({
    page,
  }) => {
    await page.goto(`/discover/cities/${citySlug}`);
    await expect(page.getByText(productTitle)).toBeVisible();
    await expect(page.getByText(serviceTitle)).toBeVisible();

    await page.goto(`/organizations/${organizationSlug}?section=products`);
    await expect(page.getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByText(productTitle)).toBeVisible();
    await page.getByRole("link", { name: "Overview" }).click();
    await expect(page).toHaveURL(/\?section=overview$/);
    await expect(page.getByText(productTitle)).toHaveCount(0);
  });

  test("shows a truthful disabled payment state", async ({ page }) => {
    await page.goto("/payments");
    await expect(
      page.getByRole("heading", { name: "Payments are not active yet." }),
    ).toBeVisible();
    await expect(page.getByText("No custody")).toBeVisible();
    await expect(page.getByRole("button", { name: /pay now/i })).toHaveCount(0);
  });

  test("authorizes and validates a service cover upload", async ({ page }) => {
    await page.goto(`/organizations/${organizationSlug}/catalog`);
    const origin = new URL(page.url()).origin;
    const image = await sharp({
      create: {
        width: 640,
        height: 480,
        channels: 3,
        background: "#18794e",
      },
    })
      .jpeg({ quality: 80 })
      .toBuffer();

    const intentResponse = await page.request.post("/api/media/uploads", {
      headers: { Origin: origin },
      data: {
        purpose: "ORGANIZATION_SERVICE_IMAGE",
        fileName: "service-cover.jpg",
        mimeType: "image/jpeg",
        sizeBytes: image.byteLength,
        altText: "Organization service cover",
      },
    });
    expect(intentResponse.status()).toBe(201);
    const intent = (await intentResponse.json()) as {
      media: { id: string };
      upload: {
        url: string;
        method: "PUT";
        headers: Record<string, string>;
      };
    };
    uploadedMediaIds.push(intent.media.id);

    const uploadResponse = await page.request.put(intent.upload.url, {
      data: image,
      headers: {
        ...intent.upload.headers,
        "Content-Length": String(image.byteLength),
        Origin: origin,
      },
    });
    expect(uploadResponse.ok()).toBe(true);

    const completeResponse = await page.request.post(
      `/api/media/uploads/${intent.media.id}/complete`,
      { headers: { Origin: origin } },
    );
    expect(completeResponse.ok()).toBe(true);
    await expect
      .poll(() =>
        prisma.mediaAsset.findUnique({
          where: { id: intent.media.id },
          select: { status: true, purpose: true },
        }),
      )
      .toEqual({ status: "ACTIVE", purpose: "ORGANIZATION_SERVICE_IMAGE" });
  });

  test("opens community horizontal sections as page-like deep links", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/communities/${communitySlug}`);
    await page
      .getByRole("navigation", { name: "Community navigation" })
      .getByRole("link", { name: "About" })
      .click();
    await expect(page).toHaveURL(/\?tab=about$/);
    await expect(
      page.getByRole("heading", { name: "A space built on trust" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Community navigation" })
      .getByRole("link", { name: "Members" })
      .click();
    await expect(page).toHaveURL(/\?tab=members$/);
    await expect(
      page.getByRole("heading", { name: "New around here" }),
    ).toBeVisible();
  });
});
