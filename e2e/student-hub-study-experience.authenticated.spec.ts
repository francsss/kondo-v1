import { expect, test } from "@playwright/test";

test.describe("Student Hub study-first experience", () => {
  test("keeps studies, resources and opportunities in three clear modules", async ({
    page,
  }) => {
    await page.goto("/student-hub");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your studies, organized around you.",
      }),
    ).toBeVisible();

    const modules = page.getByRole("navigation", {
      name: "Student Hub modules",
    });
    await expect(
      modules.getByRole("link", { name: "Studies" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      modules.getByRole("link", { name: "Opportunities" }),
    ).toBeVisible();

    const study = page.getByRole("navigation", { name: "Studies navigation" });
    for (const label of ["Overview", "Academic tools", "Student Q&A"]) {
      await expect(study.getByRole("link", { name: label })).toBeVisible();
    }
    await study.getByRole("link", { name: "Academic tools" }).click();
    await expect(page).toHaveURL(/\/student-hub\/tools/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Your academic day, organized.",
      }),
    ).toBeVisible();

    const planner = page.getByRole("navigation", { name: "Academic tools" });
    await planner.getByRole("link", { name: "Schedule" }).click();
    await expect(page).toHaveURL(/view=schedule/);

    await modules.getByRole("link", { name: "Resources" }).click();
    await expect(page).toHaveURL(/\/student-hub\/resources/);
    const resources = page.getByRole("navigation", {
      name: "Resources navigation",
    });
    for (const label of [
      "Overview",
      "Guides",
      "Student Stories",
      "Communities",
      "Housing",
      "City resources",
    ]) {
      await expect(resources.getByRole("link", { name: label })).toBeVisible();
    }

    await modules.getByRole("link", { name: "Opportunities" }).click();
    await expect(page).toHaveURL(/\/student-hub\/scholarships/);
    const opportunities = page.getByRole("navigation", {
      name: "Opportunity navigation",
    });
    for (const label of [
      "Scholarships",
      "Internships",
      "Jobs",
      "Programs & Research",
      "Applications",
    ]) {
      await expect(
        opportunities.getByRole("link", { name: label }),
      ).toBeVisible();
    }
  });

  test("keeps both navigation levels usable without mobile page overflow", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/student-hub");
    await expect(
      page.getByRole("navigation", { name: "Student Hub modules" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Studies navigation" })
        .getByRole("link", { name: "Academic tools" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("link", { name: "Skip to Student Hub content" }),
    ).toBeAttached();
    const transitionStyle = await page
      .locator("#student-hub-content > div")
      .first()
      .evaluate((element) => ({
        opacity: getComputedStyle(element).opacity,
        transform: getComputedStyle(element).transform,
      }));
    expect(transitionStyle).toEqual({ opacity: "1", transform: "none" });
  });

  test("keeps the shared Kondo brand visually locked between shells", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/home");
    const globalBrand = page.getByRole("link", { name: "Kondo home" }).first();
    await expect(globalBrand).toBeVisible();
    const globalBounds = await globalBrand.boundingBox();
    expect(globalBounds).not.toBeNull();

    await page.locator("[data-navigation-scroll]").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const scrolledBounds = await globalBrand.boundingBox();
    expect(scrolledBounds).toEqual(globalBounds);

    for (const route of ["/discover", "/communities", "/messages"]) {
      await page.goto(route);
      const routeBrand = page.getByRole("link", { name: "Kondo home" }).first();
      await expect(routeBrand).toBeVisible();
      const routeBounds = await routeBrand.boundingBox();
      expect(routeBounds).not.toBeNull();
      expect(routeBounds!.x).toBe(globalBounds!.x);
      expect(routeBounds!.y).toBe(globalBounds!.y);
      expect(routeBounds!.height).toBe(globalBounds!.height);
    }

  });

  test("opens the hub on a back control, then Kondo, then the modules", async ({
    page,
  }) => {
    // Entering the hub is a change of place: the way out comes first, the
    // academic identity has room, and the modules sit below it rather than
    // being crushed against the Kondo mark.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/student-hub");

    const back = page.getByRole("button", { name: "Back to Kondo" });
    const brand = page.getByRole("link", { name: "Kondo home" }).first();
    const modules = page.getByRole("navigation", {
      name: "Student Hub modules",
    });
    await expect(back).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(modules).toBeVisible();

    const [backBox, brandBox, modulesBox] = await Promise.all([
      back.boundingBox(),
      brand.boundingBox(),
      modules.boundingBox(),
    ]);

    // The back control leads the header, with Kondo beside it.
    expect(brandBox!.x).toBeGreaterThan(backBox!.x + backBox!.width - 1);
    expect(Math.abs(brandBox!.y - backBox!.y)).toBeLessThanOrEqual(8);

    // The modules breathe well below the identity block.
    expect(modulesBox!.y).toBeGreaterThan(backBox!.y + backBox!.height + 120);
  });
});
