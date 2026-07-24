import { expect, test } from "@playwright/test";

test.describe("admin operations", () => {
  test("can open the admin overview", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("can open the City Hub CMS and see profile-derived cities", async ({
    page,
  }) => {
    await page.goto("/admin/city-hubs");
    await expect(page).toHaveURL(/\/admin\/city-hubs/);
    await expect(
      page.getByRole("heading", { name: /city content/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Beijing" })).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Prepare Beijing content workspace",
      }),
    ).toBeVisible();
  });

  test("saves one City Hub entry through its independent section page", async ({
    browser,
    page,
  }) => {
    await page.goto("/admin/city-hubs");
    await page
      .getByRole("button", {
        name: "Prepare Beijing content workspace",
      })
      .click();

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
      page.getByRole("status").filter({
        hasText: "Entry created and saved to the City Hub draft.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "E2E Company" }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "E2E Company" }),
    ).toBeVisible();

    const savedEntry = page.locator('[data-entry-title="E2E Company"]');
    await savedEntry
      .getByLabel("Summary / description")
      .fill("Edited and persisted independently by Playwright.");

    await page.getByRole("link", { name: /management areas/i }).click();
    await expect(
      page.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue editing" }).click();
    await expect(page).toHaveURL(/\/sections\/companies$/);
    await expect(savedEntry.getByLabel("Summary / description")).toHaveValue(
      "Edited and persisted independently by Playwright.",
    );

    await page.route(
      `**/api/admin/city-hubs/*/sections/companies/entries/*`,
      (route) => route.abort(),
    );
    await savedEntry.getByRole("button", { name: "Save entry" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Could not save this entry" }),
    ).toBeVisible();
    await expect(savedEntry.getByLabel("Summary / description")).toHaveValue(
      "Edited and persisted independently by Playwright.",
    );
    await page.unroute(`**/api/admin/city-hubs/*/sections/companies/entries/*`);

    await savedEntry.getByRole("button", { name: "Save entry" }).click();
    await expect(
      page.getByRole("status").filter({
        hasText: "Entry changes saved to the City Hub draft.",
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page
        .locator('[data-entry-title="E2E Company"]')
        .getByLabel("Summary / description"),
    ).toHaveValue("Edited and persisted independently by Playwright.");

    const sectionUrl = page.url();
    const appOrigin = new URL(sectionUrl).origin;
    const reconnectedContext = await browser.newContext();
    const reconnectedPage = await reconnectedContext.newPage();
    await reconnectedPage.goto(`${appOrigin}/login`);
    await reconnectedPage
      .getByPlaceholder("you@university.edu")
      .fill(process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "admin@kondo.app");
    await reconnectedPage
      .locator('input[name="password"]')
      .fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "ChangeMe123!");
    await reconnectedPage.getByRole("button", { name: /sign in/i }).click();
    await expect(reconnectedPage).toHaveURL(/\/(home|onboarding)/);
    await reconnectedPage.goto(sectionUrl);
    await expect(
      reconnectedPage
        .locator('[data-entry-title="E2E Company"]')
        .getByLabel("Summary / description"),
    ).toHaveValue("Edited and persisted independently by Playwright.");
    await reconnectedContext.close();

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
