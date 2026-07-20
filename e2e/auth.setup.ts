import { expect, test as setup } from "@playwright/test";

const authFile = "e2e/.auth/user.json";

const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "ChangeMe123!";

setup("authenticate as a seeded member", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@university.edu").fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(home|onboarding)/);
  await page.context().storageState({ path: authFile });
});
