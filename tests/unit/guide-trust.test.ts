import { describe, expect, it } from "vitest";
import {
  guideTrust,
  mayPresentAsVerified,
  readableGuideWhere,
} from "@/lib/guide-trust";

/**
 * These guard a safety property, not a cosmetic one. A student acts on this
 * information — a residence-permit deadline, a payment setup — so Kondo must
 * never present unchecked content as checked, and must never leak an unfinished
 * or withdrawn guide into discovery.
 */

const MONTH = new Date("2026-08-15T00:00:00Z");

describe("guide readability", () => {
  it("offers only published guides that are verified or awaiting review", () => {
    expect(readableGuideWhere.published).toBe(true);
    expect(readableGuideWhere.contentStatus).toEqual({
      in: ["VERIFIED", "NEEDS_REVIEW"],
    });
  });

  it("never exposes drafts or archived guides", () => {
    const readable = readableGuideWhere.contentStatus.in;
    expect(readable).not.toContain("DRAFT");
    expect(readable).not.toContain("ARCHIVED");
  });
});

describe("guide trust presentation", () => {
  it("claims verification only for verified content", () => {
    expect(
      guideTrust({
        contentStatus: "VERIFIED",
        lastVerifiedAt: MONTH,
        reviewDueAt: null,
      }).verified,
    ).toBe(true);

    for (const status of ["NEEDS_REVIEW", "DRAFT", "ARCHIVED"] as const) {
      const trust = guideTrust({
        contentStatus: status,
        lastVerifiedAt: MONTH,
        reviewDueAt: null,
      });
      expect(trust.verified, status).toBe(false);
      // Even with a date present, unverified content must not imply checking.
      expect(trust.note.toLowerCase(), status).toContain("not yet reviewed");
    }
  });

  it("tells the reader when nobody has ever reviewed it", () => {
    const trust = guideTrust({
      contentStatus: "NEEDS_REVIEW",
      lastVerifiedAt: null,
      reviewDueAt: null,
    });
    expect(trust.reviewedLabel).toBeNull();
    expect(trust.note).toMatch(/confirm anything critical/i);
  });

  it("shows the month a guide was last reviewed", () => {
    const trust = guideTrust({
      contentStatus: "VERIFIED",
      lastVerifiedAt: MONTH,
      reviewDueAt: null,
    });
    expect(trust.reviewedLabel).toBe("Last reviewed August 2026");
  });

  it("flags verified content that is overdue for a fresh check", () => {
    const trust = guideTrust({
      contentStatus: "VERIFIED",
      lastVerifiedAt: new Date("2024-01-01T00:00:00Z"),
      reviewDueAt: new Date("2025-01-01T00:00:00Z"),
    });
    expect(trust.reviewOverdue).toBe(true);
    expect(trust.note).toMatch(/fresh review/i);
  });

  it("does not call unverified content overdue", () => {
    const trust = guideTrust({
      contentStatus: "NEEDS_REVIEW",
      lastVerifiedAt: null,
      reviewDueAt: new Date("2020-01-01T00:00:00Z"),
    });
    expect(trust.reviewOverdue).toBe(false);
  });
});

describe("verified presentation requires a source", () => {
  it("refuses a verified treatment with no source recorded", () => {
    expect(
      mayPresentAsVerified({ contentStatus: "VERIFIED", sourceCount: 0 }),
    ).toBe(false);
  });

  it("allows it once a source exists", () => {
    expect(
      mayPresentAsVerified({ contentStatus: "VERIFIED", sourceCount: 2 }),
    ).toBe(true);
  });

  it("never allows it for unverified content, sourced or not", () => {
    for (const status of ["NEEDS_REVIEW", "DRAFT", "ARCHIVED"] as const) {
      expect(
        mayPresentAsVerified({ contentStatus: status, sourceCount: 5 }),
        status,
      ).toBe(false);
    }
  });
});
