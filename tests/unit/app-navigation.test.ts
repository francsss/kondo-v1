import { describe, expect, it } from "vitest";
import {
  DISCOVER_MOBILE_INDEX,
  STUDENT_HUB_NAVIGATION,
  desktopNavigation,
  isNavigationItemActive,
  mobileNavigation,
} from "@/components/app/AppShell";

const hrefs = (items: readonly { href: string }[]) =>
  items.map((item) => item.href);

describe("general Kondo mobile navigation", () => {
  it("carries exactly the five primary destinations, in order", () => {
    expect(hrefs(mobileNavigation)).toEqual([
      "/home",
      "/marketplace",
      "/discover",
      "/communities",
      "/messages",
    ]);
  });

  it("puts Discover in the centre column", () => {
    // Five columns, so the centre is index 2 — the slot that carries the extra
    // visual weight. Reordering the array without moving the constant would
    // emphasise the wrong destination.
    expect(mobileNavigation).toHaveLength(5);
    expect(DISCOVER_MOBILE_INDEX).toBe(Math.floor(mobileNavigation.length / 2));
    expect(mobileNavigation[DISCOVER_MOBILE_INDEX]?.href).toBe("/discover");
  });

  it("keeps Student Hub out of the bottom bar", () => {
    // The hub is a space you enter from the top bar, not a sixth tab.
    expect(hrefs(mobileNavigation)).not.toContain(STUDENT_HUB_NAVIGATION.href);
  });

  it("labels every destination", () => {
    for (const item of mobileNavigation) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });
});

describe("desktop navigation", () => {
  it("keeps Student Hub in the sidebar, where there is room for it", () => {
    expect(hrefs(desktopNavigation)).toEqual([
      "/home",
      "/student-hub",
      "/marketplace",
      "/discover",
      "/communities",
      "/messages",
    ]);
  });

  it("offers every mobile destination too, so nothing is mobile-only", () => {
    for (const item of mobileNavigation) {
      expect(hrefs(desktopNavigation)).toContain(item.href);
    }
  });

  it("lists each destination once", () => {
    expect(new Set(hrefs(desktopNavigation)).size).toBe(
      desktopNavigation.length,
    );
  });
});

describe("active navigation state", () => {
  it("marks a destination active on its own route and below it", () => {
    const marketplace = { href: "/marketplace" };
    expect(isNavigationItemActive("/marketplace", marketplace)).toBe(true);
    expect(
      isNavigationItemActive("/marketplace/some-listing", marketplace),
    ).toBe(true);
  });

  it("does not let one destination claim another's prefix", () => {
    expect(
      isNavigationItemActive("/marketplace-archive", { href: "/marketplace" }),
    ).toBe(false);
    expect(isNavigationItemActive("/home", { href: "/messages" })).toBe(false);
  });

  it("keeps Student Hub active across the routes it owns", () => {
    for (const path of [
      "/student-hub",
      "/student-hub/essentials",
      "/guides",
      "/guides/arrival-checklist",
      "/help",
    ]) {
      expect(isNavigationItemActive(path, STUDENT_HUB_NAVIGATION)).toBe(true);
    }
    expect(isNavigationItemActive("/home", STUDENT_HUB_NAVIGATION)).toBe(false);
  });
});
