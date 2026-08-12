import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "");
const adminEmail = `onboarding-admin-${suffix}@example.test`;
const prospectiveEmail = `prospective-${suffix}@example.test`;
const currentEmail = `current-${suffix}@example.test`;
const password = "StrongPass1";

let cityId = "";
let universityId = "";
let cityName = "";
let universityName = "";

async function registerPersonal(
  page: import("@playwright/test").Page,
  input: { email: string; firstName: string },
) {
  await page.goto("/register");
  await page.locator('input[name="firstName"]').fill(input.firstName);
  await page.locator('input[name="lastName"]').fill("Journey");
  await page.locator('input[name="email"]').fill(input.email);
  await page.getByRole("button", { name: "Woman" }).click();
  await page.getByRole("button", { name: "Country / Region" }).click();
  await page
    .getByRole("textbox", { name: "Search country or region…" })
    .fill("Rwanda");
  await page.getByRole("option", { name: /rwanda/i }).click();
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.locator('input[name="acceptedTerms"]').check();
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/onboarding\/personal/);
}

async function continueOnboarding(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Continue" }).click();
}

test.describe.serial("restructured personal onboarding", () => {
  test.skip(
    !hasDisposableDatabase,
    "These mutation journeys require the disposable PostgreSQL test database.",
  );

  test.beforeAll(async () => {
    const china = await prisma.country.upsert({
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
    await prisma.user.create({
      data: {
        email: adminEmail,
        firstName: "Onboarding",
        lastName: "Administrator",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    cityName = `Journey City ${suffix}`;
    universityName = `Journey University ${suffix}`;
    const city = await prisma.city.create({
      data: {
        slug: `journey-city-${suffix}`,
        name: cityName,
        province: "Zhejiang",
        countryId: china.id,
        isActive: true,
        verified: true,
      },
    });
    cityId = city.id;
    const university = await prisma.university.create({
      data: {
        slug: `journey-university-${suffix}`,
        name: universityName,
        shortName: `JU-${suffix.slice(0, 5)}`,
        countryId: china.id,
        cityId: city.id,
        isActive: true,
        verified: true,
      },
    });
    universityId = university.id;
  });

  test.afterAll(async () => {
    if (!hasDisposableDatabase) {
      await prisma.$disconnect();
      return;
    }
    const users = await prisma.user.findMany({
      where: {
        email: { in: [adminEmail, prospectiveEmail, currentEmail] },
      },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    await prisma.community.deleteMany({
      where: {
        OR: [{ createdById: { in: userIds } }, { ownerId: { in: userIds } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.university.deleteMany({ where: { id: universityId } });
    await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.$disconnect();
  });

  test("a prospective student completes mobile onboarding without a university", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await registerPersonal(page, {
      email: prospectiveEmail,
      firstName: "Prospective",
    });
    const registered = await prisma.user.findUniqueOrThrow({
      where: { email: prospectiveEmail },
      select: { id: true },
    });

    // Registration already captured gender and country of origin, so the
    // journey step must not ask for either of them again.
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await expect(page.getByRole("group", { name: "Gender" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Country / Region" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: /Preparing for China/ }).click();
    await continueOnboarding(page);

    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await expect(
      page.getByText("I have not chosen a university yet"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Bachelor’s" }).click();
    await continueOnboarding(page);

    await expect(page.getByText("Step 3 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/home/);

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { email: prospectiveEmail },
        select: {
          id: true,
          studentJourney: true,
          cityId: true,
          universityId: true,
          onboardingCompletedAt: true,
          journeyDetail: { select: { journeyGroup: true, journeyStage: true } },
        },
      }),
    ).resolves.toEqual({
      id: registered.id,
      studentJourney: "PROSPECTIVE_STUDENT",
      cityId: null,
      universityId: null,
      onboardingCompletedAt: expect.any(Date),
      journeyDetail: {
        journeyGroup: "PREPARING_FOR_CHINA",
        journeyStage: "EXPLORING",
      },
    });
  });

  test("a current student completes onboarding with a city and university", async ({
    page,
  }) => {
    await registerPersonal(page, {
      email: currentEmail,
      firstName: "Current",
    });
    await page
      .getByRole("button", { name: /Studying and living in China/ })
      .click();
    await continueOnboarding(page);

    // Campus and program used to live on two separate steps.
    await expect(page.getByText("Step 2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Study city" }).click();
    await page
      .getByRole("textbox", { name: "Search cities or provinces…" })
      .fill(cityName);
    await page.getByRole("option", { name: new RegExp(cityName) }).click();
    await page.getByRole("button", { name: "University" }).click();
    await page
      .getByRole("textbox", { name: "Search universities…" })
      .fill(universityName);
    await page
      .getByRole("option", { name: new RegExp(universityName) })
      .click();
    await page.getByLabel("Program or study field").fill("Computer Science");
    await page.getByRole("button", { name: "Bachelor’s" }).click();
    await continueOnboarding(page);

    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/home/);

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { email: currentEmail },
        select: {
          studentJourney: true,
          cityId: true,
          universityId: true,
          onboardingCompletedAt: true,
          journeyDetail: { select: { journeyGroup: true, journeyStage: true } },
        },
      }),
    ).resolves.toEqual({
      studentJourney: "CURRENT_STUDENT",
      cityId,
      universityId,
      onboardingCompletedAt: expect.any(Date),
      journeyDetail: {
        journeyGroup: "STUDYING_AND_LIVING_IN_CHINA",
        journeyStage: "NEW_ARRIVAL",
      },
    });
  });

  test("an existing completed user signs in directly to home", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@university.edu").fill(prospectiveEmail);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/home/);
  });
});
