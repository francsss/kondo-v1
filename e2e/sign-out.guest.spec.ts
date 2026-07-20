import { expect, test } from "@playwright/test";

// Deliberately not part of the shared `authenticated` project: that project
// reuses one storageState/session across all of its parallel tests, and
// logging out revokes that session server-side, which would knock the other
// tests running in parallel back to the login page. This test logs in with
// its own throwaway page/session instead.

const EMAIL = process.env.PLAYWRIGHT_TEST_EMAIL ?? "ama@example.com";
const PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD ?? "ChangeMe123!";

test("can sign out and lose access to the authenticated shell", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@university.edu").fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(home|onboarding)/);

  await page.goto("/home");
  await page
    .getByRole("button", { name: /sign out/i })
    .first()
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});
