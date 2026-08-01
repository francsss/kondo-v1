import { expect, test } from "@playwright/test";

test.describe("Student Hub study-first experience", () => {
  test("keeps study work and opportunities in two clear modules", async ({
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
    await expect(
      modules.getByRole("link", { name: "Opportunities" }),
    ).toBeVisible();

    const study = page.getByRole("navigation", { name: "Study navigation" });
    for (const label of ["Overview", "Planner", "Student Q&A"]) {
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
    await planner.getByRole("button", { name: "Schedule" }).click();
    await expect(page).toHaveURL(/view=schedule/);

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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/student-hub");
    await expect(
      page.getByRole("navigation", { name: "Student Hub modules" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Study navigation" })
        .getByRole("link", { name: "Planner" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    ).toBe(true);
  });
});
