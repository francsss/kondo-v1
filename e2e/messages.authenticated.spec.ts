import { expect, test } from "@playwright/test";

test.describe("premium messaging", () => {
  test("opens a conversation, preserves a draft, and sends once", async ({
    page,
  }) => {
    await page.goto("/messages");
    await expect(
      page.getByRole("searchbox", { name: "Search conversations" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: /open conversation with/i })
      .first()
      .click();

    const composer = page.getByRole("textbox", { name: "Message" });
    await expect(composer).toBeVisible();
    await composer.fill("Draft preserved across refresh");
    await page.reload();
    await expect(composer).toHaveValue("Draft preserved across refresh");

    const message = `Reliable E2E message ${Date.now()}`;
    await composer.fill(message);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(message, { exact: true })).toHaveCount(1);
    await expect(composer).toHaveValue("");
  });

  test("keeps the conversation usable without horizontal overflow on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/messages");
    await page
      .getByRole("link", { name: /open conversation with/i })
      .first()
      .click();
    await expect(page.getByRole("textbox", { name: "Message" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send message" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
});
