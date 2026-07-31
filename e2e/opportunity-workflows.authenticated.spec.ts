import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const organizationSlug = `e2e-opportunity-org-${suffix}`;
const opportunitySlug = `e2e-kondo-opportunity-${suffix}`;
const opportunityTitle = `E2E Kondo Scholarship ${suffix}`;
let organizationId = "";

test.describe.serial("complete Opportunities journeys", () => {
  test.skip(
    !hasDisposableDatabase,
    "This journey requires the disposable PostgreSQL test database.",
  );

  test.beforeAll(async () => {
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: authenticatedEmail },
      select: { id: true },
    });
    const country = await prisma.country.upsert({
      where: { code: "CN" },
      update: { isActive: true },
      create: { code: "CN", name: "China", emoji: "🇨🇳", isActive: true },
    });
    const organization = await prisma.organization.create({
      data: {
        publicName: `E2E Opportunity Publisher ${suffix}`,
        slug: organizationSlug,
        type: "COMPANY",
        countryId: country.id,
        shortDescription: "Disposable publisher for opportunity browser tests.",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        setupCompletedAt: new Date(),
        createdById: owner.id,
        memberships: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
        capabilities: {
          create: [
            { key: "SCHOLARSHIPS", status: "ENABLED" },
            { key: "INTERNSHIPS_JOBS", status: "ENABLED" },
          ],
        },
        opportunities: {
          create: {
            slug: opportunitySlug,
            type: "SCHOLARSHIP",
            lifecycle: "PUBLISHED",
            publisherType: "ORGANIZATION",
            createdByUserId: owner.id,
            title: opportunityTitle,
            shortDescription:
              "A safe disposable scholarship for complete application tests.",
            description:
              "This temporary opportunity validates Kondo's complete application, privacy and status experience.",
            countryId: country.id,
            applicationMethod: "KONDO_APPLICATION",
            applicationDeadline: new Date(Date.now() + 30 * 86_400_000),
            publishedAt: new Date(),
            scholarshipDetail: { create: { fundingType: "OTHER" } },
          },
        },
      },
    });
    organizationId = organization.id;
  });

  test.afterAll(async () => {
    if (organizationId) {
      await prisma.organization.deleteMany({ where: { id: organizationId } });
    }
    await prisma.$disconnect();
  });

  test("creates a publisher draft with the guided editor", async ({ page }) => {
    await page.goto(`/organizations/${organizationSlug}/opportunities/new`);
    await expect(
      page.getByRole("heading", { name: "Create an opportunity" }),
    ).toBeVisible();
    await page.getByLabel("Title").fill(`Draft Scholarship ${suffix}`);
    await page
      .getByLabel("Short summary")
      .fill(
        "A clear and accurate draft scholarship for international students.",
      );
    await page
      .getByLabel("Detailed description")
      .fill(
        "This draft contains enough verified information to validate the publisher creation workflow without inventing funding or outcomes.",
      );
    await page.getByRole("button", { name: "Review" }).click();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${organizationSlug}/opportunities$`),
    );
    await expect(page.getByText(`Draft Scholarship ${suffix}`)).toBeVisible();
  });

  test("filters, saves and opens a published opportunity", async ({ page }) => {
    await page.goto("/opportunities");
    await page
      .getByRole("searchbox", { name: /search opportunities/i })
      .fill(opportunityTitle);
    await expect(page).toHaveURL(/q=/);
    await page.getByRole("link", { name: opportunityTitle }).first().click();
    await expect(
      page.getByRole("heading", { name: opportunityTitle }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Saved", exact: true }),
    ).toBeVisible();
  });

  test("submits the seven-step Kondo application", async ({ page }) => {
    await page.goto(`/opportunities/${opportunitySlug}/apply`);
    await expect(page.getByText("Review your eligibility")).toBeVisible();
    await page.getByLabel(/I reviewed the criteria/i).check();
    for (let step = 0; step < 6; step += 1) {
      await page.getByRole("button", { name: /Save & continue/i }).click();
    }
    await page
      .getByLabel(/I confirm that the information is accurate/i)
      .check();
    await page.getByRole("button", { name: "Submit application" }).click();
    await expect(page).toHaveURL(/\/opportunities\/applications\//);
    await expect(page.getByText(/Submitted/).first()).toBeVisible();
  });

  test("keeps the private profile, preferences and document vault responsive", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [path, heading] of [
      ["/opportunities/profile", "Opportunity profile"],
      ["/opportunities/preferences", "Opportunity preferences"],
      ["/opportunities/documents", "My documents"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
});
