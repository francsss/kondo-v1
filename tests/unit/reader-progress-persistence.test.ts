import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The reader must not lose the position it promised to keep.
 *
 * The debounce that stops a write on every page turn also swallowed the last
 * one. Its cleanup called `clearTimeout` and nothing else, so anyone who left
 * a book within two seconds of turning a page — which is most people, because
 * turning a page is the last thing you do before leaving — had their position
 * dropped. Nothing failed: no request was made at all, and because reading
 * progress is what puts a free title on the My Library shelf, the book simply
 * was not there. It read to a student as a page that needed refreshing.
 *
 * Three separate things had to be true to fix it, and each is easy to undo by
 * accident later, so each is asserted here against the source. This is a
 * structural test rather than a behavioural one: the alternative is a jsdom
 * harness around epub.js, which cannot render and would test the mock.
 */

const source = readFileSync(
  resolve("src/components/features/student-hub/BookReader.tsx"),
  "utf8",
);

describe("reading position survives leaving the book", () => {
  it("writes the first position of a session immediately", () => {
    // Whether a member has started a book decides whether it appears on their
    // shelf, so that fact cannot wait two seconds behind a debounce.
    expect(source).toContain("hasSavedRef");
    const scheduled = source.slice(source.indexOf("const scheduleSave"));
    expect(scheduled).toMatch(/if \(!hasSavedRef\.current\)/);
  });

  it("keeps the pending write somewhere it can still be sent", () => {
    // `clearTimeout` alone destroys the payload with the timer.
    expect(source).toContain("pendingSaveRef");
  });

  it("sends the pending write when the component goes away", () => {
    const cleanup = source.slice(source.indexOf("      cancelled = true;"));
    expect(cleanup).toContain("pendingSaveRef.current");
    expect(cleanup).toMatch(
      /sendProgress\(pending\.locator, pending\.percentage\)/,
    );
  });

  it("sends it when the page is hidden or closed as well", () => {
    /*
     * React's cleanup does not run when the browser leaves the document, and
     * on a phone the usual way to stop reading is to switch apps — which fires
     * neither an unmount nor `unload`.
     */
    expect(source).toContain('addEventListener("visibilitychange"');
    expect(source).toContain('addEventListener("pagehide"');
  });

  it("uses keepalive so the request outlives the page", () => {
    expect(source).toContain("keepalive: true");
  });
});

/**
 * Student Story is a reels feed, not a story sequence.
 *
 * The segment bars across the top were the clearest signal that it was not:
 * one bar per item, filling as the current video played, exactly as Instagram
 * and Facebook draw a story. They are gone, and the video loops rather than
 * handing over to the next one on its own.
 */
describe("the reels feed carries no story chrome", () => {
  const reader = readFileSync(
    resolve("src/components/features/stories/StoryReader.tsx"),
    "utf8",
  );

  it("draws no per-item progress bar", () => {
    expect(reader).not.toContain("playbackProgress");
    // The bar was the only thing pinned that high; nothing else should be.
    expect(reader).not.toContain("top-[max(0.35rem,env(safe-area-inset-top))]");
  });

  it("loops the current reel instead of advancing to the next", () => {
    expect(reader).toContain("loop\n");
    expect(reader).not.toContain("loop={false}");
    // Auto-advance on end is what made it a sequence.
    expect(reader).not.toContain("onEnded={() => onEnded(story)}");
  });

  it("still counts a completed watch, without re-rendering to do it", () => {
    expect(reader).toContain("onProgressTick");
    expect(reader).toContain("STORY_COMPLETED");
    const tick = reader.slice(reader.indexOf("function onProgressTick"));
    const body = tick.slice(0, tick.indexOf("\n  }"));
    expect(body).not.toContain("setState");
    expect(body).not.toMatch(/set[A-Z]\w*\(/);
  });
});

/**
 * What a student can actually upload.
 *
 * WebM is what `MediaRecorder` produces in Chrome and Firefox, so anything
 * recorded in the browser rather than picked from a camera roll arrives as
 * WebM — and the policy refused it, even though the validator has always been
 * able to parse it. The list stays closed: every entry is a container a
 * browser can play without transcoding, which Kondo has no infrastructure for.
 */
describe("story video formats", () => {
  it("accepts the containers phones and browsers actually produce", async () => {
    const { MEDIA_POLICIES } = await import("@/lib/media-policy");
    const policy = MEDIA_POLICIES.STORY_VIDEO;
    expect(Object.keys(policy.mimeExtensions)).toEqual(
      expect.arrayContaining(["video/mp4", "video/quicktime", "video/webm"]),
    );
  });

  it("does not accept an arbitrary file dressed as a video", async () => {
    const { MEDIA_POLICIES } = await import("@/lib/media-policy");
    const policy = MEDIA_POLICIES.STORY_VIDEO;
    expect(policy.mimeExtensions).not.toHaveProperty(
      "application/octet-stream",
    );
    expect(policy.mimeExtensions).not.toHaveProperty("video/x-msvideo");
    expect(policy.kind).toBe("VIDEO");
  });
});
