import { expect, test } from "@playwright/test";

test.describe("Part 7 Journey, Navigator and Saved", () => {
  test("shows a confirmed Journey and deterministic Navigator on Home", async ({
    page,
  }) => {
    await page.goto("/home");
    const journey = page.getByRole("region", {
      name: "Your Kondo journey and Navigator",
    });
    await expect(
      journey.getByText("Your journey", { exact: true }),
    ).toBeVisible();
    await expect(
      journey.getByText("Kondo Navigator", { exact: true }),
    ).toBeVisible();
    await journey.getByRole("button", { name: "Update your journey" }).click();
    for (const label of [
      "Preparing for China",
      "Studying and living in China",
      "Career, alumni and entrepreneurship",
    ]) {
      await expect(journey.getByRole("button", { name: label })).toBeVisible();
    }
    await expect(
      journey.getByRole("button", { name: "Confirm update" }),
    ).toBeDisabled();
  });

  test("opens one private Saved hub with typed filters", async ({ page }) => {
    await page.goto("/saved");
    await expect(
      page.getByRole("heading", { name: "Saved", level: 1 }),
    ).toBeVisible();
    const filters = page.getByRole("navigation", {
      name: "Saved item filters",
    });
    for (const label of [
      "All",
      "Opportunities",
      "Housing",
      "Products",
      "Services",
      "Marketplace",
    ]) {
      await expect(filters.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("offers the product notification categories without a page jump", async ({
    page,
  }) => {
    await page.goto("/notifications");
    const categories = page.getByRole("navigation", {
      name: "Notification categories",
    });
    for (const label of [
      "Applications",
      "Opportunities",
      "Housing",
      "Organizations",
      "Messages",
      "System",
    ]) {
      await expect(categories.getByRole("link", { name: label })).toBeVisible();
    }
  });
});
