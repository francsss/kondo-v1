import { expect, test } from "@playwright/test";

test.describe("authenticated member journeys", () => {
  test("can open the Explore-your-city hub for Jiaxing", async ({ page }) => {
    await page.goto("/explore/jiaxing");
    await expect(page).toHaveURL(/\/explore\/jiaxing/);
    await expect(page.getByText(/Jiaxing/i).first()).toBeVisible();
    // A section link should navigate into a city section.
    const sectionLink = page
      .getByRole("link", { name: /companies|universities|services|products/i })
      .first();
    if (await sectionLink.count()) {
      await sectionLink.click();
      await expect(page).toHaveURL(/\/explore\/jiaxing\/.+/);
    }
  });

  test("can open notifications and settings surfaces", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page).toHaveURL(/\/notifications/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

    await page.goto("/settings/appearance");
    await expect(page).toHaveURL(/\/settings\/appearance/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("toggles the color theme immediately and persists it", async ({
    page,
  }) => {
    await page.goto("/home");
    const originalTheme = await page.evaluate(async () => {
      const response = await fetch("/api/settings", { credentials: "include" });
      const payload = await response.json();
      return payload.preferences.theme as "LIGHT" | "DARK" | "SYSTEM";
    });

    // Start from a deterministic light state without reloading after the click
    // that is under test.
    await page.evaluate(async () => {
      await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: "LIGHT" }),
      });
      localStorage.setItem("theme", "light");
    });
    await page.reload();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    const toggle = page.getByRole("button", { name: "Switch to dark mode" });
    const savedPreference = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/settings") &&
        response.request().method() === "PATCH",
    );
    await toggle.click();
    await expect(page.locator("html")).toHaveClass(/dark/, { timeout: 1_000 });
    const preferenceResponse = await savedPreference;
    expect(preferenceResponse.ok()).toBe(true);
    await expect(
      page.getByRole("button", { name: "Switch to light mode" }),
    ).toBeEnabled();

    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/communities");
    await expect(page.locator("html")).toHaveClass(/dark/);

    await page.evaluate(async (theme) => {
      await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      localStorage.setItem("theme", theme.toLowerCase());
    }, originalTheme);
  });

  test("can open the profile edit page", async ({ page }) => {
    await page.goto("/profile/edit");
    await expect(page).toHaveURL(/\/profile\/edit/);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("exposes the five primary destinations on a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    for (const label of [
      "Home",
      "Communities",
      "Marketplace",
      "Student Hub",
      "Messages",
    ]) {
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}`) }).first(),
      ).toBeVisible();
    }
  });
});
