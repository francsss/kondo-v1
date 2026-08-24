import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Who is allowed to put a reel in Student Story.
 *
 * Everyone, unless they have lost the right to. It used to be admins and
 * hand-approved creators only, so an ordinary student's video went to
 * `PENDING_REVIEW` and stayed there: they uploaded, were told it was
 * submitted, and never saw it appear. In practice the feed could only ever
 * contain Kondo's own videos, which is the opposite of what Student Story is
 * for.
 *
 * Moderation did not go away, it moved to after publication — reports,
 * `removedAt`, `moderationReason` and the admin queue all act on published
 * stories already. Suspension is the one thing that still stops someone
 * posting, and it is checked before eligibility is ever consulted, so these
 * assert both halves.
 */

const stories = readFileSync(resolve("src/lib/stories.ts"), "utf8");

describe("publishing eligibility", () => {
  it("does not require an approved-creator status", () => {
    const gate = stories.slice(
      stories.indexOf("function canPublishDirectly"),
    );
    const body = gate.slice(0, gate.indexOf("\n}"));
    expect(body).not.toContain("APPROVED_CREATOR");
    expect(body).not.toContain("TRUSTED_CREATOR");
    expect(body).not.toContain("STORY_CMS_MANAGE");
  });

  it("turns only on suspension", () => {
    const gate = stories.slice(
      stories.indexOf("function canPublishDirectly"),
    );
    const body = gate.slice(0, gate.indexOf("\n}"));
    expect(body).toContain('storyCreatorStatus !== "SUSPENDED"');
  });

  it("still refuses a suspended account outright", () => {
    // Belt and braces: the submission path rejects before eligibility runs.
    expect(stories).toContain('actor.storyCreatorStatus === "SUSPENDED"');
    expect(stories).toContain(
      "Story publishing is suspended for this account.",
    );
  });

  it("keeps the moderation surface that makes publish-first safe", () => {
    // Publishing first is only defensible while these still exist.
    expect(stories).toContain("removedAt");
    expect(stories).toContain("moderationReason");
  });
});

/**
 * Posting has to be reachable from the feed.
 *
 * The only route in used to be a button in the empty state, which by
 * definition disappears the moment Student Story has anything in it — so on
 * any real feed there was no way to add a reel at all.
 */
describe("the feed offers a way to post", () => {
  const reader = readFileSync(
    resolve("src/components/features/stories/StoryReader.tsx"),
    "utf8",
  );

  it("has a post control in the feed chrome, not only the empty state", () => {
    expect(reader).toContain('aria-label="Post a reel"');
    // Two links to submit now: the empty state and the persistent control.
    const links = reader.split('href="/stories/submit"').length - 1;
    expect(links).toBeGreaterThanOrEqual(2);
  });
});
