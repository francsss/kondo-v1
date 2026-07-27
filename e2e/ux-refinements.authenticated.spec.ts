import { expect, test } from "@playwright/test";

test.describe("premium UX refinements", () => {
  test("keeps mobile forms inside the viewport with non-zooming controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/marketplace?view=exchange");
    await page.getByRole("button", { name: "Create an offer" }).click();

    const amount = page.getByPlaceholder("500");
    const note = page.getByPlaceholder(
      "Add a public meeting area or useful context. Never post bank details.",
    );
    await expect(amount).toBeVisible();
    await amount.focus();
    await amount.fill("500");
    await note.fill("Safe campus meeting point");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const control of [amount, note]) {
      expect(
        Number.parseFloat(
          await control.evaluate(
            (element) => getComputedStyle(element).fontSize,
          ),
        ),
      ).toBeGreaterThanOrEqual(16);
      expect(
        await control.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.left >= 0 && bounds.right <= window.innerWidth + 1;
        }),
      ).toBe(true);
    }

    expect(
      await page.locator('meta[name="viewport"]').getAttribute("content"),
    ).not.toMatch(/maximum-scale|user-scalable=no/);
  });

  test("keeps sub-navigation on one row and scrolls only when space runs out", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/communities");

    const communityNavigation = page.getByRole("navigation", {
      name: "Community sections",
    });
    await expect(communityNavigation).toBeVisible();
    for (const label of ["My Communities", "Discover", "Meet"]) {
      await expect(
        communityNavigation.getByRole("link", { name: label }),
      ).toBeVisible();
    }
    expect(
      await communityNavigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    expect(
      await communityNavigation.evaluate(
        (element) =>
          new Set(
            Array.from(element.children).map(
              (child) => child.getBoundingClientRect().top,
            ),
          ).size,
      ),
    ).toBe(1);

    await page.goto("/student-hub");
    const mobileStudentNavigation = page.getByRole("navigation", {
      name: "Student Hub mobile",
    });
    for (const label of [
      "Guides",
      "Scholarships",
      "Internships",
      "Opportunities",
      "Tools",
    ]) {
      await expect(
        mobileStudentNavigation.getByRole("link", { name: label }),
      ).toBeVisible();
    }
    expect(
      await mobileStudentNavigation.evaluate(
        (element) =>
          new Set(
            Array.from(element.children).map(
              (child) => child.getBoundingClientRect().top,
            ),
          ).size,
      ),
    ).toBe(1);
    expect(
      await mobileStudentNavigation.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);

    await page.setViewportSize({ width: 768, height: 900 });
    const tabletStudentNavigation = page.getByRole("navigation", {
      name: "Student Hub",
      exact: true,
    });
    await expect(tabletStudentNavigation).toBeVisible();
    expect(
      await tabletStudentNavigation.evaluate(
        (element) =>
          new Set(
            Array.from(element.children).map(
              (child) => child.getBoundingClientRect().top,
            ),
          ).size,
      ),
    ).toBe(1);
    expect(
      await tabletStudentNavigation.evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
  });

  test("uses searchable smart selectors for exchange offers", async ({
    page,
  }) => {
    await page.goto("/marketplace?view=exchange");
    await page.getByRole("button", { name: "Create an offer" }).click();

    await page.getByRole("button", { name: "Currency I need" }).click();
    const search = page.getByRole("textbox", {
      name: "Search code or currency",
    });
    await search.fill("XAF");
    await expect(
      page.getByRole("option", {
        name: /XAF · Central African CFA Franc/,
      }),
    ).toBeVisible();
  });

  test("keeps instant video exclusive to Random and uses a privacy-first map for Nearby", async ({
    page,
  }) => {
    await page.goto("/communities?tab=meet");
    await expect(
      page.getByRole("button", { name: "Discovery Settings" }),
    ).toBeVisible();
    await expect(page.getByText("Meet Premium", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Nearby" }).click();

    await expect(
      page.getByText("Your map begins with your choices"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Random Matching" }),
    ).toHaveCount(0);

    await expect(page.getByText("Approximate discovery enabled")).toBeVisible();
    await page.getByRole("button", { name: "20 km" }).click();
    await page.getByRole("button", { name: "Explore people" }).click();
    await expect(page.getByText("Approximate map · never exact")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Preview / }).first(),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page
      .getByRole("button", { name: /^Preview / })
      .first()
      .click();
    await expect(
      page.getByRole("button", { name: "Full profile" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Full profile" }).click();
    await expect(page.getByRole("dialog")).toContainText("Meet Premium");
  });
});
