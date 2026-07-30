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
    await expect(
      page.getByRole("heading", { name: "Useful stories are on the way" }),
    ).toBeVisible();
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
    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("dialog", { name: "Mobile navigation" });
    const links = navigation.getByRole("link");
    const hrefs = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute("href")),
    );
    expect(hrefs.slice(1, 6)).toEqual([
      "/home",
      "/communities",
      "/marketplace",
      "/student-hub",
      "/messages",
    ]);
    await expect(navigation.getByText("More from Kondo")).toBeVisible();
    await expect(
      navigation.getByLabel(/Current workspace: Personal/),
    ).toBeVisible();
    await expect(
      navigation.getByRole("button", {
        name: /Switch to (dark|light) mode/,
      }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Student Stories" }),
    ).toHaveAttribute("href", "/stories");
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
