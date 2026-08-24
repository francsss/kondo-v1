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
    const welcome = main.getByRole("heading", { name: /welcome back/i });
    const activity = main.getByRole("heading", { name: "Kondo is moving." });

    /*
     * The greeting and the activity stream are both ordinary content now. They
     * used to be a timed swap: the greeting showed, a 2.4 second timer hid it
     * and revealed the stream, and the container animated its height between
     * the two — so everything below moved long after the page had settled.
     * Both are asserted present at once, and the greeting is re-checked past
     * the old timer to prove nothing takes it away again.
     */
    await expect(welcome).toBeVisible();
    await expect(activity).toBeVisible();
    await expect(
      main.getByRole("list", { name: "Recent activity" }),
    ).toBeVisible();
    await expect(main.getByRole("button", { name: /activity/i })).toHaveCount(
      0,
    );

    const settled = await welcome.boundingBox();
    await page.waitForTimeout(3_500);
    await expect(welcome).toBeVisible();
    const later = await welcome.boundingBox();
    expect(settled).not.toBeNull();
    expect(later).not.toBeNull();
    expect(Math.abs((later?.y ?? 0) - (settled?.y ?? 0))).toBeLessThan(2);

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
