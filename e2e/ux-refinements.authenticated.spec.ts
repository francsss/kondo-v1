import { expect, test } from "@playwright/test";

test.describe("premium UX refinements", () => {
  test("keeps primary sub-sections discoverable without horizontal tab scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/communities");

    const communityNavigation = page.getByRole("navigation", {
      name: "Community sections",
    });
    await expect(communityNavigation).toBeVisible();
    for (const label of ["My Communities", "Discover", "Meet"]) {
      await expect(
        communityNavigation.getByRole("link", { name: label }),
      ).toBeVisible();
    }
    expect(
      await communityNavigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);

    await page.goto("/student-hub");
    const studentNavigation = page.getByRole("navigation", {
      name: "Student Hub mobile",
    });
    for (const label of [
      "Guides",
      "Scholarships",
      "Internships",
      "Opportunities",
      "Tools",
    ]) {
      await expect(
        studentNavigation.getByRole("link", { name: label }),
      ).toBeVisible();
    }
  });

  test("uses searchable smart selectors for exchange offers", async ({
    page,
  }) => {
    await page.goto("/marketplace?view=exchange");
    await page.getByRole("button", { name: "Create an offer" }).click();

    await page.getByRole("button", { name: "Currency I need" }).click();
    const search = page.getByRole("textbox", {
      name: "Search code or currency",
    });
    await search.fill("XAF");
    await expect(
      page.getByRole("option", {
        name: /XAF · Central African CFA Franc/,
      }),
    ).toBeVisible();
  });

  test("keeps instant video exclusive to Random and uses a privacy-first map for Nearby", async ({
    page,
  }) => {
    await page.goto("/communities?tab=meet");
    await page.getByRole("button", { name: "Nearby" }).click();

    await expect(
      page.getByText("Your map begins with your choices"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Random Matching" }),
    ).toHaveCount(0);

    await page
      .getByRole("checkbox", { name: "Appear in approximate discovery" })
      .check();
    await page.getByRole("button", { name: "Explore people" }).click();
    await expect(page.getByText("Approximate map · never exact")).toBeVisible();
  });
});
