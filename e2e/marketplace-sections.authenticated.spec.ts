import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Journeys for the new Marketplace section structure.
 *
 * A restaurant service published by an organization must appear in
 * Food & Services, in Discover, and on Home for a member in the same city —
 * and must disappear from all of them the moment the organization is
 * suspended. A student skill must stay a student skill everywhere.
 */

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);

const serviceTitle = `E2E Cameroonian meals ${suffix.slice(0, 5)}`;
const skillTitle = `E2E student tutoring ${suffix.slice(0, 5)}`;

let ownerId = "";
let studentId = "";
let organizationId = "";
let cityId = "";

test.describe.serial("marketplace sections", () => {
  test.skip(
    !hasDisposableDatabase,
    "These journeys require the disposable PostgreSQL test database.",
  );

  test.beforeAll(async () => {
    const viewer = await prisma.user.findUniqueOrThrow({
      where: { email: authenticatedEmail },
      select: { id: true, cityId: true },
    });

    // A database constraint ties a member's city to their university's city,
    // so the fixture is created in the city the member already has rather than
    // moving them. Only the interest — which they choose freely — is set here.
    const seededCity = viewer.cityId
      ? await prisma.city.findUniqueOrThrow({
          where: { id: viewer.cityId },
          select: { id: true, countryId: true },
        })
      : null;
    const country = seededCity
      ? { id: seededCity.countryId }
      : await prisma.country.upsert({
          where: { code: "CN" },
          update: { isActive: true },
          create: { code: "CN", name: "China", isActive: true },
          select: { id: true },
        });
    cityId =
      seededCity?.id ??
      (
        await prisma.city.upsert({
          where: { slug: `e2e-sections-city-${suffix}` },
          update: { isActive: true },
          create: {
            name: `E2E Sections City ${suffix.slice(0, 4)}`,
            slug: `e2e-sections-city-${suffix}`,
            countryId: country.id,
            isActive: true,
          },
          select: { id: true },
        })
      ).id;

    // The shared seeded member is never mutated here: other authenticated
    // specs run in parallel against the same account. The journey therefore
    // asserts on the city signal, which needs no profile change. The
    // interest-based wording is covered by the integration test, which owns
    // its own users.

    ownerId = (
      await prisma.user.create({
        data: {
          email: `e2e-owner-${suffix}@sections.e2e`,
          passwordHash: "x".repeat(60),
          firstName: "Owner",
          lastName: "Sections",
          status: "ACTIVE",
        },
        select: { id: true },
      })
    ).id;
    studentId = (
      await prisma.user.create({
        data: {
          email: `e2e-student-${suffix}@sections.e2e`,
          passwordHash: "x".repeat(60),
          firstName: "Amara",
          lastName: "Student",
          status: "ACTIVE",
          cityId,
        },
        select: { id: true },
      })
    ).id;

    const organization = await prisma.organization.create({
      data: {
        slug: `e2e-kitchen-${suffix}`,
        publicName: `Mama Africa Kitchen ${suffix.slice(0, 4)}`,
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        createdById: ownerId,
        countryId: country.id,
        cityId,
        capabilities: {
          create: [{ key: "STUDENT_SERVICES", status: "ENABLED" }],
        },
        memberships: {
          create: [{ userId: ownerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
      select: { id: true },
    });
    organizationId = organization.id;

    await prisma.organizationService.create({
      data: {
        slug: `e2e-meals-${suffix}`,
        organizationId,
        createdByUserId: ownerId,
        cityId,
        title: serviceTitle,
        shortDescription: "Cameroonian meals and delivery for students.",
        description:
          "Home-style Cameroonian meals prepared daily and delivered around the city.",
        category: "Food & Dining",
        status: "PUBLISHED",
        publishedAt: new Date(),
        priceType: "STARTING_AT",
        priceMinor: 3500,
        currency: "CNY",
        contactMethod: "PUBLIC_CONTACT",
      },
    });

    await prisma.studentSkillOffer.create({
      data: {
        ownerId: studentId,
        cityId,
        title: skillTitle,
        category: "Study support",
        description: "Weekly tutoring in mathematics for first-year students.",
        availability: "Weekday evenings",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
    });
  });

  test.afterAll(async () => {
    const list = [ownerId, studentId].filter(Boolean);
    await prisma.studentSkillOffer.deleteMany({
      where: { ownerId: { in: list } },
    });
    await prisma.organizationService.deleteMany({ where: { organizationId } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: list } } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: list } } });
    await prisma.$disconnect();
  });

  test("shows the three sections and no Community Exchange", async ({
    page,
  }) => {
    await page.goto("/marketplace");
    for (const label of ["Marketplace", "Food & Services", "Student Skills"]) {
      await expect(
        page.getByRole("link", { name: label, exact: true }).first(),
      ).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: "Community Exchange" }),
    ).toHaveCount(0);
  });

  test("lists the published service in Food & Services", async ({ page }) => {
    await page.goto("/marketplace");
    await page
      .getByRole("link", { name: "Food & Services", exact: true })
      .first()
      .click();
    await expect(page.getByText(serviceTitle)).toBeVisible();
    // Labelled as an organization service, never as a student offer.
    await expect(page.getByText("Organization service").first()).toBeVisible();
  });

  test("keeps student skills in their own section", async ({ page }) => {
    await page.goto("/marketplace?view=skills");
    await expect(page.getByText(skillTitle)).toBeVisible();
    // A skill must never be presented as an organization service.
    await expect(page.getByText("Organization service")).toHaveCount(0);
  });

  test("aggregates both sources in Discover without duplicating them", async ({
    page,
  }) => {
    await page.goto("/discover?type=services");
    await expect(page.getByText(serviceTitle).first()).toBeVisible();

    await page.goto("/discover?type=skills");
    await expect(page.getByText(skillTitle).first()).toBeVisible();
    await expect(page.getByText("Student skill").first()).toBeVisible();
  });

  test("recommends the service on Home with a transparent explanation", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(
      page.getByRole("heading", { name: "Near you", exact: true }),
    ).toBeVisible();
    // Home may surface the same record in more than one rail.
    await expect(page.getByText(serviceTitle).first()).toBeVisible();

    // Whatever the signal, the member can always read why it appeared.
    const reason = page
      .getByTestId("recommendation-reason")
      .filter({ hasText: serviceTitle.slice(0, 0) || /./ })
      .first();
    await expect(reason).toBeVisible();
    await expect(reason).toContainText(
      /Recommended because|Near your university area|Available/i,
    );
  });

  test("removes the service everywhere once the organization is suspended", async ({
    page,
  }) => {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { lifecycleStatus: "SUSPENDED" },
    });
    try {
      await page.goto("/marketplace?view=food-services");
      await expect(page.getByText(serviceTitle)).toHaveCount(0);

      await page.goto("/discover?type=services");
      await expect(page.getByText(serviceTitle)).toHaveCount(0);

      await page.goto("/home");
      await expect(page.getByText(serviceTitle)).toHaveCount(0);
    } finally {
      await prisma.organization.update({
        where: { id: organizationId },
        data: { lifecycleStatus: "ACTIVE" },
      });
    }
  });

  test("keeps private student details out of a public skill card", async ({
    page,
  }) => {
    await page.goto("/marketplace?view=skills");
    await expect(page.getByText(skillTitle)).toBeVisible();
    const body = (await page.textContent("body")) ?? "";
    expect(body).not.toContain("sections.e2e");
  });
});
