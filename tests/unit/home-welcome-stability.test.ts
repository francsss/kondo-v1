import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Home must not rearrange itself while it is being read.
 *
 * The greeting was a timed overlay: it rendered, a 2.4 second `setTimeout`
 * swapped it for the activity stream, and a `ResizeObserver` animated the
 * container's height between the two. Everything below moved when that
 * happened — several seconds after the page had apparently finished loading,
 * which is exactly when someone has started reading or is reaching for a
 * button. The greeting itself then vanished, so a member who looked away
 * came back to a page that had never greeted them.
 *
 * Both are ordinary content now, rendered once, in the flow.
 */

const welcome = readFileSync(
  resolve("src/components/features/home/HomeWelcome.tsx"),
  "utf8",
);
const home = readFileSync(resolve("app/(platform)/home/page.tsx"), "utf8");

describe("the welcome is stable content", () => {
  it("has no timer, no animation and no measured height", () => {
    expect(welcome).not.toContain("setTimeout");
    expect(welcome).not.toContain("ResizeObserver");
    expect(welcome).not.toContain("useLayoutEffect");
    expect(welcome).not.toContain("framer-motion");
    expect(welcome).not.toContain("motion.");
  });

  it("is a server component, so there is nothing to hydrate", () => {
    expect(welcome).not.toContain('"use client"');
    expect(welcome).not.toContain("useState");
    expect(welcome).not.toContain("useEffect");
  });

  it("still follows the member's Journey", () => {
    for (const group of [
      "PREPARING_FOR_CHINA",
      "STUDYING_AND_LIVING_IN_CHINA",
      "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
    ]) {
      expect(welcome).toContain(group);
    }
    expect(home).toContain("journeyGroup={navigator.journey.group}");
  });

  it("is one heading and two lines, not a hero card", () => {
    expect(welcome.split("<h1").length - 1).toBe(1);
    expect(welcome).not.toContain("<Card");
    expect(welcome).not.toContain("rounded-3xl");
  });
});

describe("the timed transition is gone", () => {
  it("removes the component that ran it", () => {
    expect(
      existsSync(
        resolve("src/components/features/activity/HomeActivityIntro.tsx"),
      ),
    ).toBe(false);
    expect(home).not.toContain("HomeActivityIntro");
  });

  it("renders the greeting and the activity stream together", () => {
    // Both present at once is what leaves no gap where one used to be.
    const top = home.slice(home.indexOf("<HomeWelcome"));
    expect(top.slice(0, 500)).toContain("<LiveActivityStream");
  });
});
