import { expect, test } from "@playwright/test";

test.describe("Student Stories administration", () => {
  test("opens Story moderation and official-profile review workspaces", async ({
    page,
  }) => {
    await page.goto("/admin/stories");
    await expect(
      page.getByRole("heading", { name: "Student Stories" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Official profiles" }),
    ).toBeVisible();

    await page.goto("/admin/official-profiles");
    await expect(
      page.getByRole("heading", { name: "Official profiles" }).first(),
    ).toBeVisible();
    await expect(page.getByText("Awaiting review").first()).toBeVisible();
  });

  test("opens the MVP feedback workspace with filters and export", async ({
    page,
  }) => {
    await page.goto("/admin/feedback");
    await expect(
      page.getByRole("heading", { name: "MVP feedback" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Export current results" }),
    ).toHaveAttribute("href", /\/api\/admin\/feedback\/export/);
    await expect(page.locator('select[name="status"]')).toBeVisible();
  });
});
