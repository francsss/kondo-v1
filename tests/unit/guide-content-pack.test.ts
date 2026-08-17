import { describe, expect, it } from "vitest";
import {
  GUIDE_CONTENT_PACK,
  SUPERSEDED_GUIDE_SLUGS,
} from "@/lib/guide-content-pack";

/**
 * These enforce the promises made when this content was accepted, not its
 * prose. The pack was written without access to its sources, so nothing in it
 * may claim verification, cite a placeholder, or publish the emergency guide.
 * A future edit that breaks one of those should fail here rather than reach a
 * student.
 */

describe("guide content pack", () => {
  it("claims no verification anywhere", () => {
    for (const guide of GUIDE_CONTENT_PACK) {
      expect(guide.status, guide.slug).not.toBe("VERIFIED");
    }
  });

  it("cites only real URLs, never a placeholder", () => {
    for (const guide of GUIDE_CONTENT_PACK) {
      for (const source of guide.sources) {
        expect(source.url, guide.slug).toMatch(/^https?:\/\/[^\s]+$/);
        // The pack used "(insert ... URL before publishing)" for unknowns.
        expect(source.url.toLowerCase(), guide.slug).not.toContain("insert");
        expect(source.title.toLowerCase(), guide.slug).not.toContain("insert");
        expect(source.organization, guide.slug).toBeTruthy();
      }
    }
  });

  it("keeps the emergency guide unpublished until its numbers are sourced", () => {
    const emergency = GUIDE_CONTENT_PACK.find(
      (guide) => guide.slug === "emergency-contacts-and-what-to-do",
    );
    expect(emergency).toBeDefined();
    expect(emergency!.published).toBe(false);
    expect(emergency!.status).toBe("DRAFT");
    // It must not ship a number it could not source.
    const text = emergency!.steps.map((s) => s.content).join(" ");
    expect(text).not.toMatch(/\b1(1[09]|20)\b/);
  });

  it("publishes nothing else as a draft, and drafts nothing else", () => {
    for (const guide of GUIDE_CONTENT_PACK) {
      if (guide.status === "DRAFT")
        expect(guide.published, guide.slug).toBe(false);
      else expect(guide.published, guide.slug).toBe(true);
    }
  });

  it("gives every guide real steps", () => {
    for (const guide of GUIDE_CONTENT_PACK) {
      expect(guide.steps.length, guide.slug).toBeGreaterThan(1);
      for (const step of guide.steps) {
        expect(step.title.length, guide.slug).toBeGreaterThan(3);
        expect(step.content.length, guide.slug).toBeGreaterThan(30);
      }
    }
  });

  it("uses unique slugs that do not collide with the superseded ones", () => {
    const slugs = GUIDE_CONTENT_PACK.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const superseded of SUPERSEDED_GUIDE_SLUGS) {
      expect(slugs).not.toContain(superseded);
    }
  });

  it("covers the high-priority topics the pack was asked for", () => {
    const categories = new Set(GUIDE_CONTENT_PACK.map((g) => g.category));
    for (const required of [
      "RESIDENCY",
      "MONEY",
      "ARRIVAL",
      "BEFORE_DEPARTURE",
      "TRANSPORT",
      "UNIVERSITY",
    ]) {
      expect(categories, required).toContain(required);
    }
  });
});
