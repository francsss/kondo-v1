import { expect, test } from "@playwright/test";

test.describe("authenticated critical journeys", () => {
  test("lands on home with the five primary navigation destinations", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    for (const [href, label] of [
      ["/home", "Home"],
      ["/communities", "Communities"],
      ["/marketplace", "Marketplace"],
      ["/student-hub", "Student Hub"],
      ["/messages", "Messages"],
    ] as const) {
      // Not `exact: true`: Messages/Notifications links can carry an
      // unread-count badge inside the same element, which is folded into
      // its accessible name (e.g. "Messages 1").
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}`) }).first(),
      ).toHaveAttribute("href", href);
    }
  });

  test("can browse communities, marketplace, and Student Hub without error", async ({
    page,
  }) => {
    await page.goto("/communities");
    await expect(
      page.getByRole("heading", { name: /communities/i }).first(),
    ).toBeVisible();

    await page.goto("/marketplace");
    await expect(
      page.getByRole("heading", { name: /marketplace/i }).first(),
    ).toBeVisible();

    await page.goto("/student-hub");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("search returns results for a known seeded term", async ({ page }) => {
    await page.goto("/search?q=Jiaxing");
    await expect(page.getByText(/search results/i)).toBeVisible();
  });

  test("can open the marketplace seller dashboard and start a new listing", async ({
    page,
  }) => {
    await page.goto("/marketplace");
    await page.getByRole("link", { name: /sell an item/i }).click();
    await expect(page).toHaveURL(/\/marketplace\/new/);
    await expect(
      page.getByRole("button", { name: /publish listing/i }),
    ).toBeVisible();
  });

  test("can open the messages inbox", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/messages/);
  });
});
