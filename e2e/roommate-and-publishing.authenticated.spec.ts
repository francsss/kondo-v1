import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Browser journeys for the two reported failures:
 *
 *  1. two compatible roommate profiles that never appear in Match;
 *  2. an organization that cannot publish an opportunity, with no explanation.
 *
 * Both journeys act through the interface. Records are seeded directly only to
 * create the *other* member and the starting state — never to reach a screen
 * the navigation is supposed to provide.
 */

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);

const MOVE_IN = new Date(Date.now() + 90 * 86_400_000);

let viewerId = "";
let partnerId = "";
let cityId = "";
let otherCityId = "";
let organizationId = "";
let organizationSlug = "";
let draftOpportunitySlug = "";

async function ensureCity(name: string, countryId: string) {
  const slug = `e2e-${name}-${suffix}`.toLowerCase();
  const city = await prisma.city.upsert({
    where: { slug },
    update: { isActive: true },
    create: {
      name: `E2E ${name} ${suffix.slice(0, 4)}`,
      slug,
      countryId,
      isActive: true,
    },
    select: { id: true },
  });
  return city.id;
}

function roommateProfileData(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE" as const,
    visibility: "MEMBERS_ONLY" as const,
    cityId,
    moveInDate: MOVE_IN,
    stayDurationMonths: 12,
    budgetMinimumMinor: null,
    budgetMaximumMinor: 300_000,
    currency: "CNY",
    expiresAt: null,
    preferredHousingTypes: ["PRIVATE_ROOM" as const],
    languages: ["English", "French"],
    sleepSchedule: "EARLY",
    cleanlinessPreference: "TIDY",
    smokingPreference: "NOT_ALLOWED" as const,
    petPreference: "NOT_SPECIFIED" as const,
    introduction:
      "An end-to-end roommate profile used to verify the Match experience.",
    allowInterests: true,
    ...overrides,
  };
}

async function setRoommateProfile(
  userId: string,
  overrides: Record<string, unknown> = {},
) {
  const data = roommateProfileData(overrides);
  await prisma.roommateProfile.upsert({
    where: { userId },
    create: { ...data, userId } as never,
    update: data as never,
  });
}

test.describe.serial("roommate matching and opportunity publishing", () => {
  test.skip(
    !hasDisposableDatabase,
    "These journeys require the disposable PostgreSQL test database.",
  );

  test.beforeAll(async () => {
    const viewer = await prisma.user.findUniqueOrThrow({
      where: { email: authenticatedEmail },
      select: { id: true },
    });
    viewerId = viewer.id;

    const country = await prisma.country.upsert({
      where: { code: "CN" },
      update: { isActive: true },
      create: { code: "CN", name: "China", isActive: true },
      select: { id: true },
    });
    cityId = await ensureCity("match-city", country.id);
    otherCityId = await ensureCity("other-city", country.id);

    const partner = await prisma.user.create({
      data: {
        email: `e2e-roommate-${suffix}@roommate.e2e`,
        passwordHash: "x".repeat(60),
        firstName: "Amina",
        lastName: "Partner",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    partnerId = partner.id;

    // Both members share city, move-in window, budget and languages: four
    // compatible criteria, which is exactly the reported scenario.
    await setRoommateProfile(viewerId);
    await setRoommateProfile(partnerId);

    organizationSlug = `e2e-publish-${suffix}`;
    const organization = await prisma.organization.create({
      data: {
        slug: organizationSlug,
        publicName: `E2E Publisher ${suffix.slice(0, 5)}`,
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        createdById: viewerId,
        countryId: country.id,
        capabilities: {
          create: [
            { key: "SCHOLARSHIPS", status: "ENABLED" },
            { key: "INTERNSHIPS_JOBS", status: "ENABLED" },
          ],
        },
        memberships: {
          create: [{ userId: viewerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
      select: { id: true },
    });
    organizationId = organization.id;

    draftOpportunitySlug = `e2e-draft-scholarship-${suffix}`;
    await prisma.opportunity.create({
      data: {
        slug: draftOpportunitySlug,
        type: "SCHOLARSHIP",
        lifecycle: "DRAFT",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: organizationId,
        createdByUserId: viewerId,
        countryId: country.id,
        title: `E2E publishable scholarship ${suffix.slice(0, 5)}`,
        shortDescription:
          "A scholarship draft used to verify the publishing journey end to end.",
        description:
          "A scholarship draft used to verify the publishing journey end to end, with enough text to satisfy validation.",
        applicationMethod: "EXTERNAL_URL",
        externalApplicationUrl: "https://example.edu/apply",
        officialSourceUrl: "https://example.edu/official",
        applicationDeadline: new Date(Date.now() + 60 * 86_400_000),
        scholarshipDetail: { create: { fundingType: "FULLY_FUNDED" } },
      },
      select: { id: true },
    });
  });

  test.afterAll(async () => {
    await prisma.opportunity.deleteMany({
      where: { publisherOrganizationId: organizationId },
    });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.roommateProfile.deleteMany({
      where: { userId: { in: [viewerId, partnerId] } },
    });
    await prisma.user.deleteMany({ where: { id: partnerId } });
    await prisma.$disconnect();
  });

  test("shows a compatible roommate with a readable compatibility explanation", async ({
    page,
  }) => {
    await page.goto("/housing/roommates");
    await expect(
      page.getByRole("heading", { name: /Find a compatible roommate/i }),
    ).toBeVisible();

    const partnerCard = page.getByText("Amina Partner").first();
    await expect(partnerCard).toBeVisible();

    // The card must say why this person is a match, not merely that they are.
    const explanation = page.getByTestId("roommate-compatibility").first();
    await expect(explanation).toBeVisible();
    await expect(explanation).toContainText("% compatible");
  });

  test("keeps the match when a maximum budget filter is applied", async ({
    page,
  }) => {
    // Regression: any budget filter used to remove every form-created profile.
    await page.goto("/housing/roommates");
    await page.getByPlaceholder("Max budget (CNY)").fill("4000");
    await page.getByRole("button", { name: "Find matches" }).click();
    await expect(page.getByText("Amina Partner").first()).toBeVisible();
  });

  test("drops the match and explains why when a required criterion changes", async ({
    page,
  }) => {
    await setRoommateProfile(partnerId, { cityId: otherCityId });
    await page.goto("/housing/roommates");

    await expect(page.getByText("Amina Partner")).toHaveCount(0);
    const empty = page.getByTestId("roommate-empty-explanation");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(/different city/i);

    // Restore so the following journeys start from a compatible pair.
    await setRoommateProfile(partnerId);
  });

  test("publishes a scholarship from the workspace and projects it publicly", async ({
    page,
  }) => {
    await page.goto(`/organizations/${organizationSlug}/dashboard`);
    await page
      .getByRole("link", { name: "Opportunities", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${organizationSlug}/opportunities$`),
    );

    // A draft states who owns the next step instead of failing silently.
    await expect(page.getByText(/Only your team can see this/i)).toBeVisible();

    const publish = page.getByRole("button", { name: "Publish", exact: true });
    await expect(publish).toBeEnabled();
    const transition = page.waitForResponse(
      (response) =>
        response.url().includes("/transition") &&
        response.request().method() === "POST",
    );
    await publish.click();
    expect((await transition).status()).toBe(200);
    // Assert the outcome, not the RSC refresh latency: `router.refresh()` can
    // take several seconds on this page when the full suite runs in parallel.
    await page.reload();
    await expect(page.getByText("Live and visible to students")).toBeVisible();

    // Public projection, from the one central Opportunity domain.
    await page.goto(`/opportunities/${draftOpportunitySlug}`);
    await expect(
      page.getByRole("heading", { name: /E2E publishable scholarship/i }),
    ).toBeVisible();

    await page.goto("/student-hub/scholarships");
    await expect(
      page.getByText(/E2E publishable scholarship/i).first(),
    ).toBeVisible();
  });

  test("pauses a published record and removes it from public projections", async ({
    page,
  }) => {
    await page.goto(`/organizations/${organizationSlug}/opportunities`);
    const pause = page.getByRole("button", { name: "Pause", exact: true });
    await expect(pause).toBeEnabled();
    const transition = page.waitForResponse(
      (response) =>
        response.url().includes("/transition") &&
        response.request().method() === "POST",
    );
    await pause.click();
    expect((await transition).status()).toBe(200);
    await page.reload();
    await expect(page.getByText(/Hidden from students/i)).toBeVisible();

    const response = await page.goto(`/opportunities/${draftOpportunitySlug}`);
    expect(response?.status()).toBe(404);
  });

  test("explains a blocked publication instead of failing silently", async ({
    page,
  }) => {
    // Removing the capability must not hide the feature or produce a dead
    // button: the workspace has to name the missing requirement.
    await prisma.organizationCapability.updateMany({
      where: { organizationId, key: "SCHOLARSHIPS" },
      data: { status: "DISABLED" },
    });
    try {
      await page.goto(`/organizations/${organizationSlug}/opportunities`);
      await expect(
        page
          .getByText(/has not enabled the Scholarships activity area/i)
          .first(),
      ).toBeVisible();
    } finally {
      await prisma.organizationCapability.updateMany({
        where: { organizationId, key: "SCHOLARSHIPS" },
        data: { status: "ENABLED" },
      });
    }
  });
});
