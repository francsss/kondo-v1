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
    for (const label of ["My Community", "Discover", "Meet"]) {
      await expect(
        communityNavigation.getByRole("link", { name: label }),
      ).toBeVisible();
    }
    await expect(
      communityNavigation.getByText("New", { exact: true }),
    ).toBeVisible();
    const communityWidths = await communityNavigation.evaluate((element) =>
      Array.from(element.children).map(
        (child) => child.getBoundingClientRect().width,
      ),
    );
    expect(
      Math.max(...communityWidths) - Math.min(...communityWidths),
    ).toBeLessThan(2);
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
    await communityNavigation.getByRole("link", { name: /Meet/ }).click();
    await expect(page).toHaveURL(/\/communities\?tab=meet/);
    await expect(
      page
        .getByRole("navigation", { name: "Community sections" })
        .getByText("New", { exact: true }),
    ).toHaveCount(0);

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
    await page.route("https://api.map.baidu.com/**", async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `
          (() => {
            class Point {
              constructor(lng, lat) { this.lng = lng; this.lat = lat; }
            }
            class Size {
              constructor(width, height) { this.width = width; this.height = height; }
            }
            class Icon {
              constructor(url, size, options) {
                this.url = url;
                this.size = size;
                this.options = options;
              }
            }
            class Marker {
              constructor(point, options) {
                this.point = point;
                this.options = options;
                this.listeners = {};
              }
              addEventListener(event, listener) { this.listeners[event] = listener; }
            }
            class Circle {
              constructor(point, radius, options) {
                this.point = point;
                this.radius = radius;
                this.options = options;
              }
            }
            class Map {
              constructor(container) {
                this.container = container;
                container.dataset.testMapReady = "true";
              }
              centerAndZoom() {}
              enableScrollWheelZoom() {}
              addControl() {}
              clearOverlays() {}
              addOverlay(overlay) {
                if (!(overlay instanceof Marker)) return;
                const marker = document.createElement("button");
                marker.type = "button";
                marker.setAttribute("aria-label", overlay.options.title);
                marker.style.position = "absolute";
                marker.style.left = "50%";
                marker.style.top = "50%";
                marker.style.width = "48px";
                marker.style.height = "48px";
                marker.addEventListener("click", () => overlay.listeners.click?.());
                this.container.appendChild(marker);
              }
            }
            class Geocoder {
              getPoint(_query, callback) { callback(new Point(120.75, 30.76)); }
            }
            window.BMapGL = {
              Point,
              Size,
              Icon,
              Marker,
              Circle,
              Map,
              Geocoder,
              NavigationControl: class {},
              ScaleControl: class {},
            };
            window.__kondoBaiduMapReady?.();
          })();
        `,
      });
    });
    await page.goto("/communities?tab=meet");
    await expect(
      page.getByRole("button", { name: "Discovery preferences" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Discovery matches" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Discover more people" }),
    ).toBeVisible();
    await expect(page.getByText("Meet Premium", { exact: true })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Discover more people" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Unlock more profiles",
    );
    await page
      .getByRole("button", { name: "Continue basic discovery" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
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
    const discoveryMap = page.getByRole("region", {
      name: "Nearby discovery map",
    });
    await expect(
      discoveryMap.getByText("Approximate areas · never exact"),
    ).toBeVisible();
    await expect(discoveryMap).toHaveAttribute("data-map-provider", "baidu");
    await expect(discoveryMap).toHaveAttribute("data-map-status", "ready");
    await expect(
      discoveryMap.getByRole("button", { name: /^Preview / }),
    ).not.toHaveCount(0);
    const visibleMapMarker = discoveryMap
      .getByRole("button", { name: /^Approximate area for / })
      .first();
    await expect(visibleMapMarker).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await visibleMapMarker.click({ force: true });
    await expect(
      discoveryMap.getByRole("button", { name: "Full profile" }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await discoveryMap.getByRole("button", { name: "Full profile" }).click();
    await expect(page.getByRole("dialog")).toContainText("Meet Premium");
  });
});
