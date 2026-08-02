import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "");
const slug = `e2e-public-organization-${suffix.slice(0, 10)}`;
const publicName = `E2E Public Organization ${suffix.slice(0, 5)}`;
let organizationId = "";

test.describe.serial("organization public profile", () => {
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
        slug,
        type: "STUDENT_ASSOCIATION",
        countryId: country.id,
        shortDescription:
          "A safe disposable public profile for the Kondo browser journey.",
        tagline: "Students helping students",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "READY",
        representationConfirmedAt: new Date(),
        setupCompletedAt: new Date(),
        createdById: owner.id,
        memberships: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
        contactChannels: {
          create: {
            type: "EMAIL",
            label: "Public team email",
            value: "public@example.org",
            visibility: "PUBLIC",
          },
        },
        capabilities: {
          create: { key: "STUDENT_SERVICES", status: "ENABLED" },
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

  test("previews, publishes, discovers and unpublishes the profile", async ({
    page,
  }) => {
    await page.goto(`/organizations/${slug}/public-profile`);
    await expect(
      page.getByRole("heading", { name: "Public profile" }),
    ).toBeVisible();
    await expect(page.getByText("Ready to publish")).toBeVisible();

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByText(/Private preview/)).toBeVisible();
    await expect(
      page
        .getByTestId("organization-public-profile")
        .getByRole("heading", { name: publicName, exact: true }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: "Back to public profile settings" })
      .click();
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(page.getByRole("status")).toContainText(
      "profile is now public",
    );
    // The workspace hero also offers this action once the profile is
    // published, so both links point at the same page.
    await page.getByRole("link", { name: "View public page" }).first().click();
    await expect(
      page.getByRole("heading", { name: publicName, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Unverified organization")).toBeVisible();
    await page.getByRole("button", { name: "Contact" }).click();
    await expect(
      page.getByRole("heading", { name: "Public contact channels" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: publicName, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    await page.goto(`/organizations?q=${encodeURIComponent(publicName)}`);
    await expect(
      page.getByRole("link", { name: new RegExp(publicName) }),
    ).toBeVisible();
    await page.goto(`/search?q=${encodeURIComponent(publicName)}`);
    await expect(
      page.locator(`a[href="/organizations/${slug}"]`),
    ).toBeVisible();

    await page.goto(`/organizations/${slug}/public-profile`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Unpublish" }).click();
    await expect(page.getByRole("status")).toContainText("no longer public");
    await page.goto(`/organizations/${slug}`);
    await expect(
      page.getByRole("heading", {
        name: "Organization profile unavailable",
      }),
    ).toBeVisible();
  });
});
