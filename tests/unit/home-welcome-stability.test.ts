import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Home must not rearrange itself while it is being read.
 *
 * The greeting was a timed overlay: it rendered, a 2.4 second `setTimeout`
 * swapped it for the activity rail, and a `ResizeObserver` animated the
 * container's height between the two. Everything below moved when that
 * happened — several seconds after the page had apparently finished loading,
 * which is exactly when someone has started reading or is reaching for a
 * button. The greeting itself then vanished, so a member who looked away came
 * back to a page that had never greeted them.
 *
 * It is the first slide of Kondo Life now. The rail is already a row of cards,
 * so the greeting takes no vertical space of its own: there is no block above
 * the feed whose height anything below has to react to, and no second heading
 * competing with the rail's own at the top of a phone screen.
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
    expect(welcome.split("<h2").length - 1).toBe(1);
    // The rail's own heading owns the region; this must not compete with it.
    expect(welcome).not.toContain("<h1");
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

  it("hands the greeting to Kondo Life as its lead slide", () => {
    // Inside the rail, not stacked above it: the rail owns the vertical space.
    const rail = home.slice(home.indexOf("<LiveActivityStream"));
    const block = rail.slice(
      0,
      rail.indexOf("/>", rail.indexOf("<HomeWelcome")),
    );
    expect(block).toContain("lead={");
    expect(block).toContain("<HomeWelcome");
    expect(home).not.toMatch(/<HomeWelcome[\s\S]{0,400}<LiveActivityStream/);
  });

  it("does not let the rail time out off the greeting", () => {
    /*
     * The original defect was a greeting a timer took away. Putting it in an
     * auto-advancing rail would have been the same thing wearing a carousel:
     * the rail rests on it and starts cycling only once the member moves off
     * it themselves, and wrapping never returns to it.
     */
    const stream = readFileSync(
      resolve("src/components/features/activity/LiveActivityStream.tsx"),
      "utf8",
    );
    expect(stream).toContain("if (lead && activeIndex === 0) return;");
    expect(stream).toContain("leadCount + ((((index - leadCount) % span)");
  });

  it("counts the lead slide in the rail's own indexing", () => {
    // Left out of the arithmetic, autoplay skips the greeting each cycle.
    const stream = readFileSync(
      resolve("src/components/features/activity/LiveActivityStream.tsx"),
      "utf8",
    );
    expect(stream).toContain("const leadCount = lead ? 1 : 0");
    expect(stream).toContain("const cardCount = activities.length + leadCount");
    expect(stream).toContain("data-activity-index={index + leadCount}");
  });
});
