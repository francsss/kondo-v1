import { expect, test } from "@playwright/test";

test.describe("Kondo Pet MVP feedback", () => {
  test("appears after inactivity and submits feedback in a responsive modal", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.removeItem("kondo-pet:snooze-until");
      for (const key of Object.keys(window.sessionStorage)) {
        if (key.startsWith("kondo-pet:")) window.sessionStorage.removeItem(key);
      }
    });
    let requestBody: Record<string, unknown> | undefined;
    await page.route("**/api/feedback", async (route) => {
      requestBody = route.request().postDataJSON();
      await route.fulfill({
        contentType: "application/json",
        status: 201,
        body: JSON.stringify({
          feedback: {
            id: "feedback-e2e",
            category: "IDEA",
            status: "NEW",
          },
        }),
      });
    });

    await page.goto("/home");
    const pet = page.getByRole("button", {
      name: "Share feedback with Kondo",
    });
    await expect(pet).toBeVisible({ timeout: 10_000 });
    await pet.click();

    const dialog = page.getByRole("dialog", { name: "Share your feedback" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: "Your feedback helps us improve Kondo",
      }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Your feedback")).toBeFocused();
    await dialog.getByLabel("Feedback type").selectOption("IDEA");
    await dialog
      .getByLabel("Your feedback")
      .fill("Add a checklist for incoming students.");
    await dialog.getByRole("button", { name: "Send" }).click();

    await expect(
      dialog.getByText("Thank you. Your feedback matters."),
    ).toBeVisible();
    expect(requestBody).toMatchObject({
      category: "IDEA",
      message: "Add a checklist for incoming students.",
      pagePath: "/home",
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
});
