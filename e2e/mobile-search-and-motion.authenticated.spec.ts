import { expect, test } from "@playwright/test";

const MOBILE = { width: 390, height: 844 };

test.describe("mobile search surface", () => {
  test("opens from the navbar icon and hands results back to /search", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/home");

    // Below `sm` the navbar has room for an icon, not a field.
    await expect(
      page.locator("header").getByRole("link", { name: /Search Kondo/ }),
    ).toHaveCount(0);
    const trigger = page.getByRole("button", { name: "Search Kondo" });
    await expect(trigger).toBeVisible();

    // The header must not move as the surface opens over it.
    const headerBefore = await page.locator("header").boundingBox();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Search Kondo" });
    await expect(dialog).toBeVisible();
    const headerAfter = await page.locator("header").boundingBox();
    expect(Math.abs(headerBefore!.y - headerAfter!.y)).toBeLessThan(1);
    expect(Math.abs(headerBefore!.height - headerAfter!.height)).toBeLessThan(
      1,
    );

    // Results come from the same /api/search the /search page renders from.
    await page.locator('input[aria-label="Search Kondo"]').fill("beijing");
    await expect(
      dialog.getByRole("link", { name: /See all results/ }),
    ).toBeVisible();
    await dialog.getByRole("link", { name: /See all results/ }).click();
    await expect(page).toHaveURL(/\/search\?q=beijing/);
  });

  test("sizes itself to the keyboard-reduced viewport without jumping", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/home");
    await page.getByRole("button", { name: "Search Kondo" }).click();
    const dialog = page.getByRole("dialog", { name: "Search Kondo" });
    await expect(dialog).toBeVisible();

    const before = await dialog.boundingBox();
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).toBe("hidden");

    // A software keyboard shrinks the visual viewport, which
    // MobileViewportStabilizer publishes as --visual-viewport-height. Headless
    // Chromium raises no keyboard, so drive the variable the way the
    // stabilizer does and confirm the surface follows it instead of
    // overflowing or scrolling the page underneath.
    const keyboard = 320;
    await page.evaluate((height) => {
      document.documentElement.style.setProperty(
        "--visual-viewport-height",
        `${window.innerHeight - height}px`,
      );
    }, keyboard);

    await expect
      .poll(async () => Math.round((await dialog.boundingBox())!.height))
      .toBe(Math.round(before!.height - keyboard));
    const after = await dialog.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // Closing hands scrolling back to the page.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(
      await page.evaluate(() => getComputedStyle(document.body).overflow),
    ).not.toBe("hidden");
  });
});

test.describe("navigation motion", () => {
  test("animates the active destination by default", async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto("/home");
    const icon = page
      .getByRole("navigation", { name: "Mobile quick navigation" })
      .locator('a[aria-current="page"] > span')
      .first();
    const style = await icon.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        property: computed.transitionProperty,
        transform: computed.transform,
      };
    });
    expect(style.property).not.toBe("none");
    expect(style.transform).not.toBe("none");
  });

  test("holds still when the reader asks for reduced motion", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE);
    // Emulated on the page rather than through `test.use`: a nested describe's
    // option did not reach the context here, and this states the intent where
    // the test can see it.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/home");
    expect(
      await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    const icon = page
      .getByRole("navigation", { name: "Mobile quick navigation" })
      .locator('a[aria-current="page"] > span')
      .first();
    const style = await icon.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        // Tailwind's `transition-none` sets transition-property, not duration,
        // so duration is not the thing to assert on.
        property: computed.transitionProperty,
        transform: computed.transform,
      };
    });
    expect(style.property).toBe("none");
    expect(style.transform).toBe("none");

    await page.getByRole("button", { name: "Search Kondo" }).click();
    await expect(
      page.getByRole("dialog", { name: "Search Kondo" }),
    ).toBeVisible();
    expect(
      await page
        .locator(".animate-overlay-in")
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
  });
});
