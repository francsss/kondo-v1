import { expect, test } from "@playwright/test";

test.describe("premium UX refinements", () => {
  test("keeps every top navigation control on one vertical axis", async ({
    page,
  }) => {
    // The avatar used to sit on the text baseline of a bare inline link,
    // three pixels above the icon buttons beside it.
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 834, height: 1112 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/home");
      const centers = await page
        .locator("header")
        .first()
        .evaluate((header) =>
          [
            '[aria-label="Open navigation"]',
            '[aria-label^="Notifications"]',
            '[aria-label="Open profile"] [role="img"]',
            '[aria-label="Open Explore menu"]',
            'a[href="/search"]',
          ]
            .map((selector) => header.querySelector(selector))
            .filter((element): element is Element => Boolean(element))
            .map((element) => {
              const box = element.getBoundingClientRect();
              // A control hidden at this breakpoint reports a zero box.
              return box.height ? box.top + box.height / 2 : null;
            })
            .filter((center): center is number => center !== null),
        );
      expect(centers.length, `controls at ${viewport.width}px`).toBeGreaterThan(
        2,
      );
      expect(
        Math.max(...centers) - Math.min(...centers),
        `vertical drift at ${viewport.width}px`,
      ).toBeLessThanOrEqual(0.5);
    }
  });

  test("keeps long Home publications compact until the reader expands them", async ({
    page,
  }) => {
    await page.goto("/home");
    const post = page
      .getByRole("article")
      .filter({
        hasText: "Three things I wish I checked before signing my lease",
      })
      .first();
    const expander = post.getByRole("button", { name: "See more" });
    await expect(expander).toBeVisible();
    await expect(expander).toHaveAttribute("aria-expanded", "false");

    const contentId = await expander.getAttribute("aria-controls");
    expect(contentId).toBeTruthy();
    const content = page.locator(`#${contentId}`);
    const collapsedHeight = await content.evaluate(
      (element) => element.getBoundingClientRect().height,
    );

    await expander.click();
    const collapseButton = post.getByRole("button", { name: "See less" });
    await expect(collapseButton).toHaveAttribute("aria-expanded", "true");
    await expect
      .poll(() =>
        content.evaluate((element) => element.getBoundingClientRect().height),
      )
      .toBeGreaterThan(collapsedHeight);
  });

  test("keeps the Home feed comfortably wide without viewport overflow", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/home");

    const post = page
      .getByRole("article")
      .filter({
        hasText: "Three things I wish I checked before signing my lease",
      })
      .first();
    await expect(post).toBeVisible();

    const desktopBounds = await post.boundingBox();
    expect(desktopBounds).not.toBeNull();
    expect(desktopBounds!.width).toBeGreaterThanOrEqual(600);
    expect(desktopBounds!.width).toBeLessThanOrEqual(780);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    const reducedMotionStyle = await post.evaluate((element) => {
      const reveal = element.closest<HTMLElement>("[data-home-feed-reveal]");
      return reveal
        ? {
            opacity: getComputedStyle(reveal).opacity,
            transform: getComputedStyle(reveal).transform,
          }
        : null;
    });
    expect(reducedMotionStyle).toEqual({ opacity: "1", transform: "none" });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(post).toBeVisible();

    const mobileBounds = await post.boundingBox();
    expect(mobileBounds).not.toBeNull();
    expect(mobileBounds!.x).toBeLessThanOrEqual(13);
    /*
     * The card fills the phone, minus the page gutter — and the page is
     * narrower than the viewport.
     *
     * `html` sets `scrollbar-gutter: stable`, which reserves the scrollbar
     * track on every route so the header cannot jump sideways between a short
     * page and a scrolling one. On a classic-scrollbar platform that costs
     * ~15px, so a 390px viewport lays out at ~375px, and `px-3` on the feed
     * container takes 12px from each side. Asking for 360px here required the
     * gutter not to exist, which is why this failed everywhere it was
     * reserved. What matters to a reader is that the card still spans the
     * page rather than sitting in a narrow column.
     */
    expect(mobileBounds!.width).toBeGreaterThanOrEqual(345);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });

  test("keeps mobile forms inside the viewport with non-zooming controls", async ({
    page,
  }) => {
    // Community Exchange left the visible product, so this now exercises the
    // Student Skills studio — the peer form students actually reach.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/marketplace?view=skills");
    await page.getByRole("button", { name: "Create an offer" }).click();

    const title = page.getByPlaceholder(
      "I can help with conversational Mandarin",
    );
    await expect(title).toBeVisible();
    await title.focus();
    await title.fill("Mathematics tutoring");

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const control of [title]) {
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
  });

  test("uses searchable smart selectors in the Student Skills studio", async ({
    page,
  }) => {
    // The currency selector belonged to Community Exchange, which is retired.
    // The same searchable-select pattern is verified where it still ships.
    await page.goto("/marketplace?view=skills");
    await page.getByRole("button", { name: "Create an offer" }).click();

    await page.getByRole("button", { name: "Skill category" }).click();
    const search = page.getByRole("textbox", {
      name: "Search skill categories",
    });
    await search.fill("Study");
    await expect(
      page.getByRole("option", { name: /Study support/i }),
    ).toBeVisible();
  });

  test("retires Community Exchange from the visible experience", async ({
    page,
  }) => {
    await page.goto("/marketplace?view=exchange");
    // The old link still resolves rather than 404ing.
    await expect(page).toHaveURL(/\/marketplace$/);
    await expect(
      page.getByRole("link", { name: "Community Exchange" }),
    ).toHaveCount(0);
    for (const label of ["Marketplace", "Food & Services", "Student Skills"]) {
      await expect(
        page.getByRole("link", { name: label, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("keeps instant video exclusive to Random and drops the Nearby map mode", async ({
    page,
  }) => {
    await page.addInitScript({
      content: `
        class TestMap {
          constructor(container) {
            this.container = container;
            container.dataset.testMapReady = "true";
          }
          setCenter() {}
          setZoom() {}
        }
        class TestCircle {
          setMap() {}
        }
        class TestOverlay {
          setMap(map) {
            this.map = map;
            if (map) {
              this.onAdd?.();
              this.draw?.();
            } else {
              this.onRemove?.();
            }
          }
          getPanes() {
            return { overlayMouseTarget: this.map.container };
          }
          getProjection() {
            return {
              fromLatLngToDivPixel: () => ({ x: 320, y: 240 }),
            };
          }
        }
        const mapsEvent = {
          addListenerOnce(_target, _event, listener) {
            queueMicrotask(listener);
            return { remove() {} };
          },
          clearInstanceListeners() {},
          trigger() {},
        };
        window.google = {
          maps: {
            Circle: TestCircle,
            Geocoder: class {
              async geocode() {
                return {
                  results: [
                    {
                      geometry: {
                        location: {
                          toJSON: () => ({ lat: 30.743861, lng: 120.719407 }),
                        },
                      },
                    },
                  ],
                };
              }
            },
            Map: TestMap,
            OverlayView: TestOverlay,
            event: mapsEvent,
            importLibrary: async (library) =>
              library === "geocoding"
                ? { Geocoder: window.google.maps.Geocoder }
                : { Map: TestMap },
          },
        };
      `,
    });
    await page.goto("/communities?tab=meet");
    const preferencesButton = page.getByRole("button", {
      name: "Discovery preferences",
    });
    const birthYear = page.getByRole("spinbutton", {
      name: "Year of birth",
    });
    await expect(preferencesButton.or(birthYear)).toBeVisible();
    if (await birthYear.isVisible()) {
      if (!(await birthYear.inputValue())) {
        await birthYear.fill("2000");
      }
      await page.getByRole("button", { name: "Enter Meet" }).click();
    }
    await expect(preferencesButton).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Discovery matches" }),
    ).toBeVisible();
    await expect(page.getByText("Meet Premium", { exact: true })).toHaveCount(
      0,
    );
    const discoverMore = page.getByRole("button", {
      name: "Discover more people",
    });
    if ((await discoverMore.count()) > 0) {
      await expect(discoverMore).toBeVisible();
      await discoverMore.click();
      await expect(page.getByRole("dialog")).toContainText(
        "Unlock more profiles",
      );
      await page
        .getByRole("button", { name: "Continue basic discovery" })
        .click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    /*
     * Nearby is no longer a Meet mode, so the switcher must not offer it. It
     * moved to Community → Nearby as a list, because the map here plotted
     * positions Kondo has never stored.
     */
    await expect(
      page.getByRole("navigation", { name: "Meet modes" }).getByRole("button", {
        name: "Nearby",
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start Random Matching" }),
    ).not.toHaveCount(0);
  });

  test("shows Nearby as a list of students with no map", async ({ page }) => {
    await page.goto("/communities?tab=nearby");

    await expect(
      page.getByRole("heading", { name: "Nearby", exact: true }),
    ).toBeVisible();

    // The map is gone, in every form it used to take.
    await expect(
      page.getByRole("region", { name: "Nearby discovery map" }),
    ).toHaveCount(0);
    await expect(page.locator("[data-map-provider]")).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);

    /*
     * Either the list or one of its honest fallbacks, depending on what the
     * seeded account has: students, nobody nearby yet, or no study city set.
     */
    const list = page.getByRole("list", { name: "Students near you" });
    const empty = page.getByText("No students nearby yet.");
    const noLocation = page.getByRole("heading", {
      name: "Find students near you",
    });
    await expect(list.or(empty).or(noLocation).first()).toBeVisible();

    if (await list.isVisible()) {
      // Nothing may claim a distance Kondo cannot know.
      await expect(list).not.toContainText(/\d+\s*(m|km)\b/);
      await expect(
        page.getByRole("switch", {
          name: /Visible to others|Hidden from others/,
        }),
      ).toHaveCount(1);
    }
  });
});
