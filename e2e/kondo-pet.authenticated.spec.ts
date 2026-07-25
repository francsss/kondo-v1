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
      name: "Donner votre avis à Kondo",
    });
    await expect(pet).toBeVisible({ timeout: 10_000 });
    await pet.click();

    const dialog = page.getByRole("dialog", { name: "Partager votre avis" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: "Votre avis nous aide à améliorer Kondo",
      }),
    ).toBeVisible();
    await expect(dialog.getByLabel("Votre retour")).toBeFocused();
    await dialog.getByLabel("Type de retour").selectOption("IDEA");
    await dialog
      .getByLabel("Votre retour")
      .fill("Ajouter une checklist pour les nouveaux étudiants.");
    await dialog.getByRole("button", { name: "Envoyer" }).click();

    await expect(dialog.getByText("Merci, votre avis compte.")).toBeVisible();
    expect(requestBody).toMatchObject({
      category: "IDEA",
      message: "Ajouter une checklist pour les nouveaux étudiants.",
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
