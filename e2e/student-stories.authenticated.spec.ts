import { expect, test } from "@playwright/test";

test.describe("Student Stories access and responsive navigation", () => {
  test("opens Student Stories from the existing desktop secondary menu", async ({
    page,
  }) => {
    await page.goto("/home");
    await page.getByRole("button", { name: "Open Explore menu" }).click();
    const menu = page.getByRole("menu");
    await expect(
      menu.getByRole("menuitem", { name: /Student Stories/i }),
    ).toBeVisible();
    await menu.getByRole("menuitem", { name: /Student Stories/i }).click();
    await expect(page).toHaveURL(/\/stories$/);
    await expect(page.getByRole("main")).toBeVisible();
  });

  test("keeps all five primary destinations in order on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/home");
    await expect(
      page.locator("header").getByLabel(/Current workspace: Personal/),
    ).toHaveCount(0);
    await expect(
      page
        .locator("header")
        .getByRole("button", { name: /Switch to (dark|light) mode/ }),
    ).toHaveCount(0);
    // The five primary destinations live in the bottom quick-navigation bar on
    // mobile; the drawer carries the secondary destinations and account
    // controls. Assert each against the surface that actually owns it.
    //
    // Student Hub is not among them: it is a dedicated environment entered from
    // the top bar, which is what frees the centre slot for Discover.
    const quickNavigation = page.getByRole("navigation", {
      name: "Mobile quick navigation",
    });
    const quickHrefs = await quickNavigation
      .getByRole("link")
      .evaluateAll((items) => items.map((item) => item.getAttribute("href")));
    expect(quickHrefs).toEqual([
      "/home",
      "/marketplace",
      "/discover",
      "/communities",
      "/messages",
    ]);
    await expect(
      page.locator("header").getByRole("link", { name: "Student Hub" }),
    ).toHaveAttribute("href", "/student-hub");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Mobile navigation" });
    await expect(
      navigation.getByLabel(/Current workspace: Personal/),
    ).toBeVisible();
    await expect(
      navigation.getByRole("button", {
        name: /Switch to (dark|light) mode/,
      }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Housing" }),
    ).toHaveAttribute("href", "/housing");
    // The drawer labels this destination "Student Story" (singular).
    await expect(
      navigation.getByRole("link", { name: "Student Story" }),
    ).toHaveAttribute("href", "/stories");
    await expect(
      navigation.getByRole("link", { name: "Saved" }),
    ).toHaveAttribute("href", "/saved");
    // Discover is a primary destination now, so the drawer must not repeat it —
    // one control per destination.
    await expect(
      navigation.getByRole("link", { name: "Discover" }),
    ).toHaveCount(0);
  });

  test("opens publishing and official-profile workflows without overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [path, heading] of [
      ["/stories/submit", "Submit a useful Story"],
      ["/settings/official-profile", "Official profile"],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading }).first(),
      ).toBeVisible();
      if (path === "/stories/submit") {
        await expect(
          page.getByRole("combobox", { name: "Related resource" }),
        ).toBeVisible();
      }
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
    }
  });

  test("keeps city resource pages responsive with contextual Stories support", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/explore/jiaxing/events");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  });
});
