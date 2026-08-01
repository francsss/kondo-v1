import { expect, test } from "@playwright/test";

test.describe("authenticated critical journeys", () => {
  test("does not expose administrator pages to a standard member", async ({
    page,
  }) => {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/home/);
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test("lands on home with the five primary navigation destinations", async ({
    page,
  }) => {
    await page.goto("/home");
    await expect(page).toHaveURL(/\/home/);
    const main = page.getByRole("main");
    const transition = main.getByTestId("home-activity-transition");
    const welcome = main.getByRole("heading", { name: /welcome back/i });
    const beforeReveal = await transition.boundingBox();
    await expect(welcome).toBeVisible();
    await expect(
      main.getByRole("heading", { name: "Kondo is moving." }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(welcome).toBeHidden();
    await expect(
      main.getByRole("list", { name: "Recent activity" }),
    ).toBeVisible();
    await expect(main.getByRole("button", { name: /activity/i })).toHaveCount(
      0,
    );
    const afterReveal = await transition.boundingBox();
    expect(beforeReveal).not.toBeNull();
    expect(afterReveal).not.toBeNull();
    expect(afterReveal?.height ?? 0).toBeGreaterThan(beforeReveal?.height ?? 0);

    const activityList = main.getByRole("list", { name: "Recent activity" });
    const autoplayStart = await activityList.evaluate(
      (element) => element.scrollLeft,
    );
    await expect
      .poll(() => activityList.evaluate((element) => element.scrollLeft), {
        timeout: 4_500,
      })
      .not.toBe(autoplayStart);

    await activityList.hover();
    await page.waitForTimeout(700);
    const hoverStart = await activityList.evaluate(
      (element) => element.scrollLeft,
    );
    await page.waitForTimeout(3_700);
    const hoverEnd = await activityList.evaluate(
      (element) => element.scrollLeft,
    );
    expect(Math.abs(hoverEnd - hoverStart)).toBeLessThan(2);
    for (const [href, label] of [
      ["/home", "Home"],
      ["/student-hub", "Student Hub"],
      ["/discover", "Discover"],
      ["/communities", "Communities"],
      ["/messages", "Messages"],
    ] as const) {
      // Not `exact: true`: Messages/Notifications links can carry an
      // unread-count badge inside the same element, which is folded into
      // its accessible name (e.g. "Messages 1").
      await expect(
        page.getByRole("link", { name: new RegExp(`^${label}`) }).first(),
      ).toHaveAttribute("href", href);
    }
  });

  test("can browse communities, marketplace, and Student Hub without error", async ({
    page,
  }) => {
    await page.goto("/communities");
    await expect(
      page.getByRole("heading", { name: /communities/i }).first(),
    ).toBeVisible();

    await page.goto("/marketplace");
    await expect(
      page.getByRole("heading", { name: /marketplace/i }).first(),
    ).toBeVisible();

    await page.goto("/student-hub");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  });

  test("search returns results for a known seeded term", async ({ page }) => {
    await page.goto("/search?q=Jiaxing");
    await expect(page.getByText(/search results/i)).toBeVisible();
  });

  test("can open the marketplace seller dashboard and start a new listing", async ({
    page,
  }) => {
    await page.goto("/marketplace");
    await page.getByRole("link", { name: /sell an item/i }).click();
    await expect(page).toHaveURL(/\/marketplace\/new/);
    await expect(
      page.getByRole("button", { name: /publish listing/i }),
    ).toBeVisible();
  });

  test("can open the messages inbox", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/messages/);
  });
});
