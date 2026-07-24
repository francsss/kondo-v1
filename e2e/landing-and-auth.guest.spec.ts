import { expect, test } from "@playwright/test";

test.describe("public landing and authentication", () => {
  test("landing page renders with sign-in and sign-up entry points", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /login|sign in/i }).first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("link", { name: /join kondo|create your free account/i })
        .first(),
    ).toBeVisible();
  });

  test("registration requires a password meeting the complexity rules", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.locator('input[name="firstName"]').fill("Test");
    await page.locator('input[name="lastName"]').fill("Student");
    await page
      .locator('input[name="email"]')
      .fill(`e2e-${Date.now()}@example.com`);
    await page.getByRole("button", { name: "Country of origin" }).click();
    await page
      .getByRole("textbox", { name: "Search African countries…" })
      .fill("Ghana");
    await page.getByRole("option", { name: /ghana/i }).click();
    await page.locator('input[name="password"]').fill("weak");
    await page.locator('input[name="confirmPassword"]').fill("weak");
    await page.locator('input[name="acceptedTerms"]').check();
    await page.getByRole("button", { name: /create account/i }).click();
    // Either client or server validation should surface an error rather
    // than navigating away with a password this weak.
    await expect(page).toHaveURL(/\/register/);
  });

  test("login rejects invalid credentials with a generic error", async ({
    page,
  }) => {
    await page.goto("/login");
    await page
      .getByPlaceholder("you@university.edu")
      .fill("nobody@example.com");
    await page.locator('input[name="password"]').fill("WrongPassword123");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated visitors are redirected away from the authenticated shell", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
  });

  test("forgot-password always shows a generic confirmation regardless of whether the email exists", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page
      .locator('input[name="email"]')
      .fill(`no-such-account-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });
});
