import { expect, test } from "@playwright/test";

const hasDisposableDatabase =
  process.env.DATABASE_URL?.includes("kondo_module3_test") ?? false;

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
    await page.getByRole("button", { name: "Woman" }).click();
    await page.getByRole("button", { name: "Country / Region" }).click();
    await page
      .getByRole("textbox", { name: "Search country or region…" })
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

  test("organization registration keeps one human login and omits personal-only fields", async ({
    page,
  }) => {
    let submitted: Record<string, unknown> | null = null;
    await page.route("**/api/auth/register", async (route) => {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "organization-operator", role: "MEMBER" },
          nextPath: "/onboarding/organization",
        }),
      });
    });

    await page.goto("/register");
    await page.getByRole("button", { name: /^Organization/ }).click();
    await expect(page.getByRole("group", { name: "Gender" })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Country / Region" }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/personal Kondo login.*never share a password/i),
    ).toBeVisible();

    await page.locator('input[name="firstName"]').fill("Amina");
    await page.locator('input[name="lastName"]').fill("Diallo");
    await page
      .locator('input[name="email"]')
      .fill(`organization-e2e-${Date.now()}@example.com`);
    await page.locator('input[name="password"]').fill("StrongPass1");
    await page.locator('input[name="confirmPassword"]').fill("StrongPass1");
    await page.locator('input[name="acceptedTerms"]').check();
    await page.getByRole("button", { name: /create account/i }).click();

    await expect.poll(() => submitted).not.toBeNull();
    expect(submitted).toMatchObject({ intent: "ORGANIZATION" });
    expect(submitted).not.toHaveProperty("countryCode");
    expect(submitted).not.toHaveProperty("gender");
  });

  test("an organization operator creates and resumes a real draft", async ({
    page,
  }) => {
    test.skip(
      !hasDisposableDatabase,
      "This mutation journey requires the disposable PostgreSQL test database.",
    );
    const suffix = Date.now();
    await page.goto("/register");
    await page.getByRole("button", { name: /^Organization/ }).click();
    await page.locator('input[name="firstName"]').fill("Amina");
    await page.locator('input[name="lastName"]').fill("Operator");
    await page
      .locator('input[name="email"]')
      .fill(`organization-draft-${suffix}@example.test`);
    await page.locator('input[name="password"]').fill("StrongPass1");
    await page.locator('input[name="confirmPassword"]').fill("StrongPass1");
    await page.locator('input[name="acceptedTerms"]').check();
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/onboarding\/organization/);

    await page
      .getByLabel("Public organization name")
      .fill(`Kondo Test Organization ${suffix}`);
    await page.getByRole("button", { name: "Organization type" }).click();
    await page.getByRole("textbox", { name: "Search types…" }).fill("agency");
    await page.getByRole("option", { name: /education agency/i }).click();
    await page.getByRole("button", { name: "Country" }).click();
    await page
      .getByRole("textbox", { name: "Search countries…" })
      .fill("China");
    await page.getByRole("option", { name: /china/i }).click();
    await page.getByRole("button", { name: /save & continue/i }).click();
    await expect(
      page.getByRole("heading", {
        name: "What does the organization offer?",
      }),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "What does the organization offer?",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /student services/i }).click();
    await page
      .getByLabel("Short description")
      .fill(
        "Practical and trustworthy support for students preparing to study in China.",
      );
    await page.getByRole("button", { name: /save & continue/i }).click();
    await expect(page.getByText("Draft organization")).toBeVisible();
    await expect(
      page.getByText(/verification is separate/i).first(),
    ).toBeVisible();
  });

  test("registration remains usable without horizontal clipping on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/register");
    await expect(
      page.getByRole("button", { name: /^Personal account/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Organization/ }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
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
