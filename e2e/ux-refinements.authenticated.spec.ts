import { expect, test } from "@playwright/test";

test.describe("premium UX refinements", () => {
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

  test("keeps instant video exclusive to Random and uses a privacy-first map for Nearby", async ({
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
    await page.getByRole("button", { name: "Nearby" }).click();

    await expect(
      page.getByRole("heading", {
        name: "Discover your Kondo neighborhood",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start Random Matching" }),
    ).toHaveCount(0);

    await expect(page.getByText("Approximate discovery enabled")).toBeVisible();
    await page.getByRole("button", { name: "5 km" }).click();
    await page.getByRole("button", { name: "Explore people" }).click();
    const discoveryMap = page.getByRole("region", {
      name: "Nearby discovery map",
    });
    await expect(
      discoveryMap.getByText("Approximate areas · never exact"),
    ).toBeVisible();
    await expect(discoveryMap).toHaveAttribute("data-map-provider", "google");
    const mapStatus = await discoveryMap.getAttribute("data-map-status");
    expect(["ready", "unavailable", "unconfigured"]).toContain(mapStatus);
    if (mapStatus !== "ready") {
      await expect(discoveryMap.getByRole("alert")).toContainText(
        "Real map unavailable",
      );
      await expect(discoveryMap.getByRole("alert")).toContainText(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      );
      return;
    }
    await expect(
      discoveryMap.getByRole("button", { name: /^Preview / }),
    ).not.toHaveCount(0);
    const visibleMapMarker = discoveryMap
      .getByRole("button", { name: /approximate area$/ })
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
