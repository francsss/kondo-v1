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
     * The greeting is the first slide of Kondo Life.
     *
     * It has been three things. A timed overlay first: it showed, a 2.4 second
     * timer hid it and revealed the rail, and the container animated its
     * height between the two, so everything below moved long after the page
     * had settled. Then a block above the rail, which stopped the movement but
     * put two headings at the top of a phone. Now it is a card in the rail, so
     * it owns no vertical space at all.
     *
     * The important part is that the rail *rests* on it. An auto-advancing
     * carousel would have reproduced the original defect wearing a carousel —
     * a greeting that slides away on its own a few seconds after you arrive.
     */
    await expect(welcome).toBeVisible();
    await expect(activity).toBeVisible();
    const rail = main.getByRole("list", { name: "Recent activity" });
    await expect(rail).toBeVisible();
    await expect(main.getByRole("button", { name: /activity/i })).toHaveCount(
      0,
    );
    expect(
      await welcome.evaluate((element) =>
        Boolean(element.closest('[aria-label="Recent activity"]')),
      ),
    ).toBe(true);
    expect(
      await welcome.evaluate((element) => {
        const card = element.closest("[data-activity-index]");
        const list = element.closest('[aria-label="Recent activity"]');
        return Boolean(card && list && list.firstElementChild === card);
      }),
    ).toBe(true);

    // Past both the old 2.4s welcome timer and the rail's own 3.4s tick.
    const resting = await rail.evaluate((element) => element.scrollLeft);
    await page.waitForTimeout(5_000);
    await expect(welcome).toBeVisible();
    expect(
      Math.abs(
        (await rail.evaluate((element) => element.scrollLeft)) - resting,
      ),
    ).toBeLessThan(2);

    /*
     * Once the member moves off the greeting themselves, it behaves like the
     * live rail it is — and still stops while they are pointing at it.
     */
    await rail.evaluate((element) =>
      element.scrollBy({ left: element.clientWidth, behavior: "instant" }),
    );
    await page.waitForTimeout(600);
    const engaged = await rail.evaluate((element) => element.scrollLeft);
    await expect
      .poll(() => rail.evaluate((element) => element.scrollLeft), {
        timeout: 6_000,
      })
      .not.toBe(engaged);

    await rail.hover();
    await page.waitForTimeout(700);
    const hoverStart = await rail.evaluate((element) => element.scrollLeft);
    await page.waitForTimeout(3_700);
    const hoverEnd = await rail.evaluate((element) => element.scrollLeft);
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
