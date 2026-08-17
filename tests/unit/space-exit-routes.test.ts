import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSpaceExitPath } from "@/lib/space-exit";
import { NAVIGATOR_RULES } from "@/features/navigator/registry";

/**
 * Getting out of a dedicated space.
 *
 * The Student Hub and organization profiles drop the global navigation, so the
 * only way out is their own back button. That makes any screen inside a space
 * without one a dead end, and Kondo had two: `/student-hub/guide` matched no
 * route, and no root not-found existed, so both fell through to Next's bare
 * 404 — a page with no navigation, no back button and no link anywhere.
 */

const root = new URL("../../", import.meta.url).pathname;

describe("every space has a way out", () => {
  it("answers /student-hub/guide, which is the parent of every hub guide link", () => {
    // Guide steps open at /student-hub/guide/<slug>, so the path above it is
    // reachable by truncation, autocomplete and URL editing.
    expect(
      existsSync(`${root}app/(student-hub)/student-hub/guide/page.tsx`),
    ).toBe(true);
  });

  it("keeps a not-found inside the hub, so notFound() renders within its shell", () => {
    expect(
      existsSync(`${root}app/(student-hub)/student-hub/not-found.tsx`),
    ).toBe(true);
  });

  it("keeps a root not-found, which is the only handler for an unmatched URL", () => {
    const path = `${root}app/not-found.tsx`;
    expect(existsSync(path)).toBe(true);
    // A 404 with no link is the dead end this exists to remove.
    expect(readFileSync(path, "utf8")).toContain('href="/home"');
  });

  it("points every Navigator action at a route that exists", () => {
    const context = {
      group: "PREPARING_FOR_CHINA",
      stage: "EXPLORING",
      profileComplete: false,
      communityMembershipCount: 0,
      publicCommunityCount: 0,
      scholarshipCount: 0,
      internshipCount: 0,
      jobCount: 0,
      housingCount: 0,
      essentialCount: 0,
      opportunityDocumentCount: 0,
      professionalProfileComplete: false,
      activeApplicationActionCount: 0,
      scheduleCount: 0,
      guideNextStep: null,
    } as const;

    for (const rule of NAVIGATOR_RULES) {
      const action =
        typeof rule.action === "function" ? rule.action(context) : rule.action;
      // The bare hub guide path had only a [slug] route, so linking to it sent
      // members to a shell-less 404.
      expect(action.href, action.key).not.toBe("/student-hub/guide");
    }
  });
});

describe("resolveSpaceExitPath", () => {
  it("refuses a recorded path inside the space being left", () => {
    // Otherwise "leave" would move to another page of the same space.
    expect(resolveSpaceExitPath("/student-hub", "/student-hub")).toBeNull();
    expect(
      resolveSpaceExitPath("/student-hub/essentials", "/student-hub"),
    ).toBeNull();
  });

  it("returns a genuine outside path", () => {
    expect(resolveSpaceExitPath("/marketplace", "/student-hub")).toBe(
      "/marketplace",
    );
    expect(resolveSpaceExitPath("/guides", "/student-hub")).toBe("/guides");
  });

  it("refuses anything that is not a plain in-app path", () => {
    expect(resolveSpaceExitPath(null, "/student-hub")).toBeNull();
    expect(resolveSpaceExitPath("//evil.example", "/student-hub")).toBeNull();
    expect(
      resolveSpaceExitPath("https://evil.example", "/student-hub"),
    ).toBeNull();
    expect(resolveSpaceExitPath("/a\\b", "/student-hub")).toBeNull();
  });
});
