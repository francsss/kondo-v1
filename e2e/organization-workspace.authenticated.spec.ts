import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "");
const slug = `e2e-organization-${suffix.slice(0, 12)}`;
const publicName = `E2E Student Network ${suffix.slice(0, 6)}`;
const updatedTagline = `Workspace verified ${suffix.slice(0, 8)}`;
let organizationId = "";

test.describe.serial("organization professional workspace", () => {
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
      update: { isActive: true, verified: true },
      create: {
        code: "CN",
        name: "China",
        emoji: "🇨🇳",
        isActive: true,
        verified: true,
      },
    });
    const organization = await prisma.organization.create({
      data: {
        publicName,
        legalName: `${publicName} Association`,
        slug,
        type: "STUDENT_ASSOCIATION",
        countryId: country.id,
        shortDescription:
          "A disposable organization used to validate Kondo workspace journeys.",
        lifecycleStatus: "ACTIVE",
        setupCompletedAt: new Date(),
        createdById: owner.id,
        memberships: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
        capabilities: {
          create: [
            { key: "STUDENT_SERVICES", status: "ENABLED" },
            { key: "EVENTS", status: "ENABLED" },
          ],
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

  test("opens, edits and persists an organization workspace on desktop and mobile", async ({
    page,
  }) => {
    await page.goto(`/organizations/${slug}/dashboard`);
    await expect(
      page.getByRole("heading", { name: publicName, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Active teammates")).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "Desktop navigation" })
        .getByLabel(new RegExp(`Current workspace: ${publicName}`)),
    ).toBeVisible();

    await page.goto(`/organizations/${slug}/profile`);
    await page.getByLabel("Public tagline").fill(updatedTagline);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Organization profile saved.",
    );
    await page.reload();
    await expect(page.getByLabel("Public tagline")).toHaveValue(updatedTagline);

    await expect(
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { tagline: true },
      }),
    ).resolves.toEqual({ tagline: updatedTagline });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/organizations/${slug}/dashboard`);
    await expect(
      page.getByRole("navigation", { name: "Organization workspace" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Organization workspace" })
      .getByRole("link", { name: "Team" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Team and access" }),
    ).toBeVisible();
    await expect(page.getByText(authenticatedEmail)).toBeVisible();
  });
});
