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

  test("saves one City Hub entry through its independent section page", async ({
    page,
  }) => {
    const slug = `e2e-city-${Date.now()}`;
    await page.goto("/admin/city-hubs");
    await page.getByLabel("Slug").fill(slug);
    await page.getByLabel("City name").fill("E2E City");
    await page
      .getByLabel("Seed draft from the matching registry city")
      .uncheck();
    await page.getByRole("button", { name: /create draft city hub/i }).click();

    await expect(page).toHaveURL(/\/admin\/city-hubs\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: /choose what you want to manage/i }),
    ).toBeVisible();
    await page.getByRole("heading", { name: "Local Companies" }).click();
    await expect(page).toHaveURL(/\/sections\/companies$/);

    const newEntry = page.locator("details").filter({
      hasText: "Add a Companies entry",
    });
    await newEntry.getByText("Add a Companies entry", { exact: true }).click();
    await newEntry.getByLabel("Title / name").fill("E2E Company");
    await newEntry.getByLabel("Slug", { exact: true }).fill("e2e-company");
    await newEntry.getByLabel("Category", { exact: true }).fill("Technology");
    await newEntry
      .getByLabel("Summary / description")
      .fill("Created and persisted independently by Playwright.");
    await newEntry.getByRole("button", { name: "Create entry" }).click();

    await expect(
      page.getByRole("heading", { name: "E2E Company" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "E2E Company" }),
    ).toBeVisible();

    await page.getByRole("link", { name: /management areas/i }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete draft" }).click();
    await expect(page).toHaveURL(/\/admin\/city-hubs$/);
  });

  test("can open the Guides CMS", async ({ page }) => {
    await page.goto("/admin/guides");
    await expect(page).toHaveURL(/\/admin\/guides/);
    await expect(
      page.getByRole("heading", { name: /guides/i }).first(),
    ).toBeVisible();
  });

  test("can open analytics, content, and safe platform settings", async ({
    page,
  }) => {
    for (const [href, heading] of [
      ["/admin/analytics", /analytics/i],
      ["/admin/content", /content/i],
      ["/admin/settings", /platform settings/i],
    ] as const) {
      await page.goto(href);
      await expect(page).toHaveURL(new RegExp(href));
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
    }
  });
});
