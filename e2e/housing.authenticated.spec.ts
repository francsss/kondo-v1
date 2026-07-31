import { expect, test } from "@playwright/test";

test.describe("Housing", () => {
  test("keeps the complete Housing journey easy to navigate", async ({
    page,
  }) => {
    await page.goto("/housing");
    await expect(
      page.getByRole("heading", { name: "Find a place that feels right." }),
    ).toBeVisible();

    const navigation = page.getByRole("navigation", {
      name: "Housing sections",
    });
    await expect(
      navigation.getByRole("link", { name: "Discover" }),
    ).toHaveAttribute("aria-current", "page");

    await navigation.getByRole("link", { name: "Search" }).click();
    await expect(
      page.getByRole("heading", { name: "Find your next home" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Housing sections" })
      .getByRole("link", { name: "Map" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Explore by area" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Housing sections" })
      .getByRole("link", { name: "Roommates" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Find a compatible roommate" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Housing sections" })
      .getByRole("link", { name: "Requests" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Housing requests" }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Housing sections" })
      .getByRole("link", { name: "Saved" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Saved homes", exact: true }),
    ).toBeVisible();
  });

  test("keeps the listing flow usable on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/housing/create");

    await expect(
      page.getByRole("heading", { name: "Create a trusted listing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Housing listing progress" }),
    ).toBeVisible();
    await expect(page.getByLabel("Publisher")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
