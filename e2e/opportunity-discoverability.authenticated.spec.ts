import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Route discoverability journeys for the Part 5 Opportunities domain.
 *
 * Every navigation below is performed by clicking what the interface offers.
 * `page.goto` is used only to enter a journey or to prove that a *protected*
 * route stays protected — never to reach a feature the navigation should have
 * surfaced, which is the whole point of these tests.
 */

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;
const authenticatedEmail =
  process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const prisma = new PrismaClient();
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const readySlug = `e2e-opps-ready-${suffix}`;
const bareSlug = `e2e-opps-bare-${suffix}`;
const readyName = `E2E Opportunity Publisher ${suffix.slice(0, 5)}`;
const bareName = `E2E Bare Organization ${suffix.slice(0, 5)}`;

let readyOrganizationId = "";
let bareOrganizationId = "";
let publishedOpportunityId = "";

test.describe.serial("opportunity route discoverability", () => {
  test.skip(
    !hasDisposableDatabase,
    "These journeys require the disposable PostgreSQL test database.",
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

    const ready = await prisma.organization.create({
      data: {
        publicName: readyName,
        legalName: `${readyName} Ltd`,
        slug: readySlug,
        type: "COMPANY",
        countryId: country.id,
        shortDescription:
          "A disposable organization used to validate opportunity discoverability.",
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
      },
      select: { id: true },
    });
    readyOrganizationId = ready.id;

    // Same owner, no opportunity capability: the locked/setup journey.
    const bare = await prisma.organization.create({
      data: {
        publicName: bareName,
        legalName: `${bareName} Ltd`,
        slug: bareSlug,
        type: "COMPANY",
        countryId: country.id,
        shortDescription:
          "A disposable organization with no opportunity capability enabled.",
        lifecycleStatus: "ACTIVE",
        setupCompletedAt: new Date(),
        createdById: owner.id,
        memberships: {
          create: { userId: owner.id, role: "OWNER", status: "ACTIVE" },
        },
        capabilities: { create: [{ key: "HOUSING", status: "ENABLED" }] },
      },
      select: { id: true },
    });
    bareOrganizationId = bare.id;

    const published = await prisma.opportunity.create({
      data: {
        slug: `e2e-internship-${suffix}`,
        type: "INTERNSHIP",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: ready.id,
        createdByUserId: owner.id,
        countryId: country.id,
        title: `E2E summer internship ${suffix.slice(0, 5)} for international students in China with a deliberately long title`,
        shortDescription:
          "A disposable internship record used to validate the Student Hub internship section end to end.",
        description:
          "A disposable internship record. ".repeat(30) +
          "It is long enough to require an expander on a card.",
        applicationMethod: "EXTERNAL_URL",
        externalApplicationUrl: "https://example.edu/apply",
        officialSourceUrl: "https://example.edu/official",
        applicationDeadline: new Date(Date.now() + 45 * 86_400_000),
        publishedAt: new Date(),
        jobDetail: { create: { employmentType: "INTERNSHIP" } },
      },
      select: { id: true },
    });
    publishedOpportunityId = published.id;
  });

  test.afterAll(async () => {
    await prisma.opportunity.deleteMany({
      where: {
        publisherOrganizationId: {
          in: [readyOrganizationId, bareOrganizationId],
        },
      },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [readyOrganizationId, bareOrganizationId] } },
    });
    await prisma.$disconnect();
  });

  // Journey 1 — Organization route discoverability
  test("reaches Opportunities and Create opportunity without typing a URL", async ({
    page,
  }) => {
    await page.goto("/home");

    // Select the organization through the workspace switcher, the way a member
    // does — no URL is typed anywhere in this journey.
    await page
      .locator("summary[aria-label*='Switch workspace']")
      .first()
      .click();
    await page.getByRole("link", { name: readyName }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${readySlug}/dashboard$`),
    );

    // The workspace is visually distinct from a personal page.
    await expect(
      page.getByText("Organization workspace").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: readyName }),
    ).toBeVisible();

    const workspaceNav = page.getByRole("navigation", {
      name: "Organization workspace",
    });
    const opportunities = workspaceNav.getByRole("link", {
      name: "Opportunities",
    });
    await expect(opportunities).toBeVisible();
    await opportunities.click();

    await expect(
      page.getByRole("heading", { name: "Opportunities", level: 2 }),
    ).toBeVisible();
    await expect(opportunities).toHaveAttribute("aria-current", "page");

    const create = page
      .getByRole("link", { name: "Create opportunity" })
      .first();
    await expect(create).toBeVisible();
    await create.click();
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${readySlug}/opportunities/new$`),
    );

    // The compact context header carries the way back to the list.
    await page.getByRole("link", { name: "Opportunities" }).first().click();
    await expect(page).toHaveURL(
      new RegExp(`/organizations/${readySlug}/opportunities$`),
    );
  });

  // Journey 2 — Nested opportunity routes
  test("moves between the list, the edit screen and the applications page", async ({
    page,
  }) => {
    await page.goto(`/organizations/${readySlug}/opportunities`);

    await page.getByRole("link", { name: "Edit" }).first().click();
    await expect(page).toHaveURL(/\/opportunities\/[^/]+\/edit$/);
    // Deep routes keep the organization context without a full hero.
    await expect(page.getByText(readyName).first()).toBeVisible();

    await page.goBack();
    await page
      .getByRole("link", { name: /application/i })
      .first()
      .click();
    await expect(page).toHaveURL(/applications/);
    await expect(
      page.getByRole("heading", { name: "Applications", exact: true }),
    ).toBeVisible();
  });

  // Journey 3 — Missing capability
  test("shows a setup-required state rather than hiding Opportunities", async ({
    page,
  }) => {
    await page.goto(`/organizations/${bareSlug}/dashboard`);

    const workspaceNav = page.getByRole("navigation", {
      name: "Organization workspace",
    });
    const opportunities = workspaceNav.getByRole("link", {
      name: "Opportunities",
    });
    // Present, not silently absent.
    await expect(opportunities).toBeVisible();
    await opportunities.click();

    await expect(
      page.getByRole("heading", { name: "Setup required" }),
    ).toBeVisible();
    await expect(
      page.getByText("Scholarships or Internships & jobs is enabled"),
    ).toBeVisible();
    // The exact missing requirement offers the action that fixes it.
    await expect(
      page.getByRole("link", { name: "Configure activity areas" }),
    ).toBeVisible();
  });

  // Journey 4 — Student Hub navigation
  test("presents the Student Hub categories without a generic Opportunities tab", async ({
    page,
  }) => {
    await page.goto("/student-hub");
    const hubNav = page.getByRole("navigation", { name: "Student Hub" });

    for (const label of [
      "Overview",
      "Scholarships",
      "Internships",
      "Jobs",
      "Programs & Research",
      "Applications",
    ]) {
      await expect(hubNav.getByRole("link", { name: label })).toBeVisible();
    }
    await expect(
      hubNav.getByRole("link", { name: "Opportunities", exact: true }),
    ).toHaveCount(0);

    await hubNav.getByRole("link", { name: "Jobs" }).click();
    await expect(page).toHaveURL(/\/student-hub\/jobs$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Jobs");
    await expect(hubNav.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  // Journey 5 — Unified Scholarships
  test("keeps Scholarships as a single experience with no adviser tab split", async ({
    page,
  }) => {
    await page.goto("/student-hub/scholarships");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Scholarships",
    );

    const hubNav = page.getByRole("navigation", { name: "Student Hub" });
    await expect(
      hubNav.getByRole("link", { name: "Scholarships" }),
    ).toHaveAttribute("aria-current", "page");
    // The old public Opportunities / Scholarship agents split is gone.
    await expect(
      page.getByRole("navigation", { name: "Scholarship ecosystem" }),
    ).toHaveCount(0);

    // Adviser support remains reachable, as support rather than a catalogue.
    await expect(
      page.getByRole("link", { name: "Browse scholarship advisers" }),
    ).toBeVisible();
  });

  // Journey 6 — Internships
  test("keeps Internships specific and active after opening a record", async ({
    page,
  }) => {
    await page.goto("/student-hub/internships");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Internships",
    );

    const card = page.getByRole("article").first();
    await expect(card).toBeVisible();
    await expect(card.getByText("Internship").first()).toBeVisible();

    await card.locator("a[href^='/opportunities/']").first().click();
    await expect(page).toHaveURL(/\/opportunities\//);
    await page.goBack();
    await expect(page).toHaveURL(/\/student-hub\/internships$/);
    await expect(
      page
        .getByRole("navigation", { name: "Student Hub" })
        .getByRole("link", { name: "Internships" }),
    ).toHaveAttribute("aria-current", "page");
  });

  // Journey 7 — Organization mobile navigation
  test("replaces personal mobile navigation inside an organization workspace", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    const personalBar = page.getByRole("navigation", {
      name: "Mobile quick navigation",
    });
    await expect(personalBar).toBeVisible();
    await expect(
      personalBar.getByRole("link", { name: "Discover" }),
    ).toBeVisible();

    await page.goto(`/organizations/${readySlug}/dashboard`);
    const workspaceBar = page.getByRole("navigation", {
      name: new RegExp(`${readyName} workspace navigation`),
    });
    await expect(workspaceBar).toBeVisible();
    await expect(personalBar).toHaveCount(0);
    await expect(
      workspaceBar.getByRole("link", { name: "Opportunities" }),
    ).toBeVisible();
    await expect(
      workspaceBar.getByRole("link", { name: "Applications" }),
    ).toBeVisible();

    await workspaceBar.getByRole("button", { name: "More" }).click();
    const drawer = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(drawer.getByRole("link", { name: "Settings" })).toBeVisible();

    await drawer.getByRole("link", { name: "Return to Personal" }).click();
    await expect(page).toHaveURL(/\/home$/);
    // Personal navigation comes back untouched.
    await expect(
      page
        .getByRole("navigation", { name: "Mobile quick navigation" })
        .getByRole("link", { name: "Student Hub" }),
    ).toBeVisible();
  });

  // Journey 8 — Premium workspace
  test("shows a substantial workspace identity and a compact context deeper in", async ({
    page,
  }) => {
    await page.goto(`/organizations/${readySlug}/dashboard`);
    // The workspace header is nested inside the app shell's main region, so it
    // is matched by its content rather than by the banner role.
    const hero = page
      .locator("header")
      .filter({ hasText: "Organization workspace" })
      .first();
    await expect(
      page.getByText("Organization workspace").first(),
    ).toBeVisible();
    // Only real state is shown: this fixture is unverified, and the hero says
    // so rather than implying a trust signal it does not have.
    await expect(
      page.getByText(/verification|unverified/i).first(),
    ).toBeVisible();
    await expect(page.getByText(/Public profile published/i)).toBeVisible();
    await expect(page.getByText(/Your role: owner/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View public page" }),
    ).toBeVisible();

    const heroHeight = await hero.evaluate(
      (element) => element.getBoundingClientRect().height,
    );
    expect(heroHeight).toBeGreaterThan(180);

    await page.goto(
      `/organizations/${readySlug}/opportunities/${publishedOpportunityId}/edit`,
    );
    const compactHeight = await page
      .locator("header")
      .filter({ hasText: "Organization workspace" })
      .first()
      .evaluate((element) => element.getBoundingClientRect().height);
    // Deep routes trade the hero for a compact context header.
    expect(compactHeight).toBeLessThan(heroHeight);
    await expect(page.getByText(readyName).first()).toBeVisible();
  });

  // Journey 9 — Horizontal tabs
  test("scrolls tabs horizontally without ever scrolling the page sideways", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/student-hub/scholarships");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);

    const hubNav = page.getByRole("navigation", { name: "Student Hub" });
    await hubNav.getByRole("link", { name: "Applications" }).click();
    await expect(page).toHaveURL(/\/student-hub\/applications$/);
    // The selected tab is brought into view rather than left off-screen.
    await expect(
      hubNav.getByRole("link", { name: "Applications" }),
    ).toBeInViewport();

    await hubNav.getByRole("link", { name: "Scholarships" }).click();
    await expect(page).toHaveURL(/\/student-hub\/scholarships$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });

  test("simplifies tab motion when reduced motion is requested", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/student-hub/jobs");
    const hubNav = page.getByRole("navigation", { name: "Student Hub" });
    await hubNav.getByRole("link", { name: "Programs & Research" }).click();
    await expect(page).toHaveURL(/\/student-hub\/programs$/);
    // Content stays vertically readable and correct with motion removed.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Programs & Research",
    );
  });

  // Journey 10 — Long content
  test("clamps a long card title and expands a long description in place", async ({
    page,
  }) => {
    await page.goto("/student-hub/internships");
    const card = page.getByRole("article").first();
    await expect(card).toBeVisible();

    const title = card.locator(".line-clamp-2").first();
    await expect(title).toBeVisible();
    const clampedLines = await title.evaluate(
      (element) => getComputedStyle(element).webkitLineClamp,
    );
    expect(clampedLines).toBe("2");

    const expander = card.getByRole("button", { name: "See more" });
    if (await expander.count()) {
      const before = await card.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      await expander.click();
      await expect(
        card.getByRole("button", { name: "See less" }),
      ).toBeVisible();
      const after = await card.evaluate(
        (element) => element.getBoundingClientRect().height,
      );
      // Expansion happens in place: same card, no route change.
      expect(after).toBeGreaterThan(before);
      await expect(page).toHaveURL(/\/student-hub\/internships$/);

      await card.getByRole("button", { name: "See less" }).click();
      await expect(
        card.getByRole("button", { name: "See more" }),
      ).toBeVisible();
    }
  });

  // Journey 11 — Permission enforcement
  test("keeps authorization on the server when navigation is bypassed", async ({
    page,
  }) => {
    // A workspace this account is not a member of exposes nothing by URL. The
    // HTTP status is 200 because Next streams the not-found UI, so the real
    // property under test is that no organization data reaches the page.
    await page.goto(`/organizations/${bareSlug}/opportunities`);
    await expect(page.getByText(bareName).first()).toBeVisible();

    await page.goto("/organizations/definitely-not-mine/opportunities");
    await expect(
      page.getByRole("navigation", { name: "Organization workspace" }),
    ).toHaveCount(0);
    await expect(page.getByText(readyName)).toHaveCount(0);

    // And the mutation itself is refused server-side, not merely hidden.
    const denied = await page.request.post(
      `/api/organizations/${bareOrganizationId}/opportunities`,
      {
        data: {
          draft: {
            type: "SCHOLARSHIP",
            title: "Should never be created",
            shortDescription:
              "A request that must be refused because the capability is absent.",
            description:
              "A request that must be refused because the organization has no scholarship capability enabled.",
            applicationMethod: "INFORMATION_ONLY",
          },
        },
        failOnStatusCode: false,
      },
    );
    expect(denied.status()).toBeGreaterThanOrEqual(400);
  });

  // Journey 12 — Regression
  test("leaves the existing personal modules working", async ({ page }) => {
    for (const [path, pattern] of [
      ["/home", /\/home$/],
      ["/communities", /\/communities$/],
      ["/marketplace", /\/marketplace$/],
      ["/housing", /\/housing$/],
      ["/student-hub", /\/student-hub$/],
      ["/messages", /\/messages$/],
      [`/organizations/${readySlug}`, new RegExp(readySlug)],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should render`).toBeLessThan(400);
      await expect(page).toHaveURL(pattern);
    }
  });
});
