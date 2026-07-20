import { expect, test } from "@playwright/test";

test.describe("admin operations", () => {
  test("can open the admin overview", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("can open the City Hub CMS and see the create form", async ({
    page,
  }) => {
    await page.goto("/admin/city-hubs");
    await expect(page).toHaveURL(/\/admin\/city-hubs/);
    await expect(
      page.getByRole("heading", { name: /city hubs/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create draft city hub/i }),
    ).toBeVisible();
  });

  test("can open the Guides CMS", async ({ page }) => {
    await page.goto("/admin/guides");
    await expect(page).toHaveURL(/\/admin\/guides/);
    await expect(
      page.getByRole("heading", { name: /guides/i }).first(),
    ).toBeVisible();
  });
});
