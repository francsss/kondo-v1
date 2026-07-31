import { expect, test } from "@playwright/test";

/**
 * Browser journeys for the Opportunities domain, run against a production
 * build. These cover the surfaces that do not depend on seeded organization
 * publisher data: discovery, the private application centre, saved
 * opportunities, mobile layout and cross-module regression.
 *
 * Journeys that need a published opportunity owned by a specific organization
 * (publish → review → interview → offer) are exercised by the database-backed
 * integration suite in tests/integration/opportunities-postgres.test.ts, which
 * can construct that fixture directly.
 */

test.describe("opportunities discovery", () => {
  test("opens the opportunities hub and switches category", async ({
    page,
  }) => {
    await page.goto("/opportunities");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /scholarships, internships/i,
      }),
    ).toBeVisible();

    const categories = page.getByRole("navigation", {
      name: "Opportunity categories",
    });
    await expect(categories).toBeVisible();

    await categories.getByRole("link", { name: "Scholarships" }).click();
    await expect(page).toHaveURL(/category=scholarships/);
    await expect(
      categories.getByRole("link", { name: "Scholarships" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("search filters are reachable by keyboard", async ({ page }) => {
    await page.goto("/opportunities");
    const search = page.getByRole("searchbox", {
      name: /search opportunities/i,
    });
    await search.focus();
    await expect(search).toBeFocused();
    await search.fill("engineering");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=engineering/);
  });

  test("category routes redirect into the single discovery surface", async ({
    page,
  }) => {
    for (const [path, category] of [
      ["/opportunities/scholarships", "scholarships"],
      ["/opportunities/internships", "internships"],
      ["/opportunities/jobs", "jobs"],
    ] as const) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`category=${category}`));
    }
  });

  test("legacy Student Hub opportunity routes still resolve", async ({
    page,
  }) => {
    // The generic hub entry is gone from the navigation but its URL still
    // resolves for existing links and bookmarks.
    await page.goto("/student-hub/opportunities");
    await expect(page).toHaveURL(/\/opportunities$/);

    // Internships is no longer a redirect into the generic directory: it is a
    // section that keeps the student inside the Student Hub.
    await page.goto("/student-hub/internships");
    await expect(page).toHaveURL(/\/student-hub\/internships$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Internships",
    );
  });
});

test.describe("applicant surfaces", () => {
  test("shows the private application centre", async ({ page }) => {
    await page.goto("/opportunities/applications");
    await expect(
      page.getByRole("heading", { level: 1, name: "My applications" }),
    ).toBeVisible();
    // No invented response estimates or predicted decisions.
    await expect(page.getByText(/does not predict a decision/i)).toBeVisible();
  });

  test("shows saved opportunities as private to the viewer", async ({
    page,
  }) => {
    await page.goto("/opportunities/saved");
    await expect(
      page.getByRole("heading", { level: 1, name: "Saved opportunities" }),
    ).toBeVisible();
    await expect(page.getByText(/only you can see this list/i)).toBeVisible();
  });
});

test.describe("mobile opportunities", () => {
  test("has no horizontal overflow on a small viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      "/opportunities",
      "/opportunities?category=scholarships",
      "/opportunities/saved",
      "/opportunities/applications",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  });
});

test.describe("existing module regression", () => {
  test("keeps the other core surfaces working", async ({ page }) => {
    for (const path of [
      "/home",
      "/housing",
      "/marketplace",
      "/communities",
      "/student-hub",
      // Journey 9: the legacy scholarship directory must keep working
      // unchanged alongside the new Opportunities domain.
      "/student-hub/scholarships",
      "/student-hub/scholarships/agents",
    ]) {
      const response = await page.goto(path);
      expect(
        response?.status(),
        `${path} responded ${response?.status()}`,
      ).toBeLessThan(400);
    }
  });
});
