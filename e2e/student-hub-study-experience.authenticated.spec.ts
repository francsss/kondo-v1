import { expect, test } from "@playwright/test";

test.describe("Student Hub study-first experience", () => {
  test("keeps study, guide and opportunities in three clear pillars", async ({
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
    await expect(modules.getByRole("link", { name: "Study" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(modules.getByRole("link", { name: "Guide" })).toBeVisible();
    await expect(
      modules.getByRole("link", { name: "Opportunities" }),
    ).toBeVisible();

    const study = page.getByRole("navigation", { name: "Study navigation" });
    for (const label of ["Overview", "Planner", "Study Essentials"]) {
      await expect(study.getByRole("link", { name: label })).toBeVisible();
    }
    await study.getByRole("link", { name: "Planner" }).click();
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

    // Student Q&A answers journey questions, so it lives under Guide now.
    await modules.getByRole("link", { name: "Guide" }).click();
    await expect(page).toHaveURL(/\/student-hub\/resources/);
    const guide = page.getByRole("navigation", { name: "Guide navigation" });
    for (const label of [
      "Overview",
      "Student Q&A",
      "Guides",
      "Student Stories",
      "Communities",
      "Housing",
      "City resources",
    ]) {
      await expect(guide.getByRole("link", { name: label })).toBeVisible();
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

  test("buys a Kondo essential through the simulated checkout", async ({
    page,
  }) => {
    await page.goto("/student-hub/essentials");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Everything you need to study well.",
      }),
    ).toBeVisible();

    await page
      .getByRole("link", { name: /Kondo Student Planner/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/essentials\/kondo-student-planner$/);
    await page.getByRole("link", { name: "Buy this" }).click();
    await expect(page).toHaveURL(/\/checkout$/);

    // Only the simulated provider can be selected while payments are demo.
    await expect(page.getByRole("button", { name: /Alipay/ })).toBeDisabled();
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await page.getByRole("button", { name: /^Pay / }).click();

    await expect(page).toHaveURL(/\/student-hub\/orders\/KS-/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Order confirmed" }),
    ).toBeVisible();
    await expect(page.getByText("Paid (simulated)")).toBeVisible();

    await page.getByRole("link", { name: "Your orders" }).click();
    await expect(page).toHaveURL(/\/student-hub\/orders$/);
    await expect(
      page.getByRole("link", { name: /Kondo Student Planner/ }).first(),
    ).toBeVisible();
  });

  test("sends a partner essential to the partner instead of a checkout", async ({
    page,
  }) => {
    await page.goto("/student-hub/essentials/mandarin-bridge-online-course");
    await expect(page.getByRole("link", { name: "Buy this" })).toHaveCount(0);
    const partnerLink = page.getByRole("link", {
      name: /Open on Mandarin Bridge Institute/,
    });
    await expect(partnerLink).toHaveAttribute("target", "_blank");
    await expect(partnerLink).toHaveAttribute(
      "rel",
      /noopener noreferrer nofollow/,
    );

    // A partner item has nothing to check out on Kondo.
    await page.goto(
      "/student-hub/essentials/mandarin-bridge-online-course/checkout",
    );
    await expect(page).toHaveURL(
      /\/essentials\/mandarin-bridge-online-course$/,
    );
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
        .getByRole("navigation", { name: "Study navigation" })
        .getByRole("link", { name: "Study Essentials" }),
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

  test("opens the hub on a back control and its own name, not the Kondo mark", async ({
    page,
  }) => {
    // Inside the hub the label names the space the student entered; the Kondo
    // mark belongs to the global shell they just left.
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/student-hub");

    const back = page.getByRole("button", { name: "Leave Student Hub" });
    const modules = page.getByRole("navigation", {
      name: "Student Hub modules",
    });
    await expect(back).toBeVisible();
    await expect(modules).toBeVisible();
    await expect(page.getByRole("link", { name: "Kondo home" })).toHaveCount(0);

    const [backBox, modulesBox] = await Promise.all([
      back.boundingBox(),
      modules.boundingBox(),
    ]);
    // The modules breathe well below the identity block.
    expect(modulesBox!.y).toBeGreaterThan(backBox!.y + backBox!.height + 120);

    // Each pillar shares the row width rather than clustering on one side.
    const widths = await modules
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => Math.round(link.getBoundingClientRect().width)),
      );
    expect(widths).toHaveLength(3);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });
});
