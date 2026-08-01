import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  matchesInterest,
  RECOMMENDATION_SIGNALS,
  recommendationReason,
} from "@/lib/local-recommendations";

const source = readFileSync(
  new URL("../../src/lib/local-recommendations.ts", import.meta.url),
  "utf8",
);

describe("recommendation signals", () => {
  it("ranks signals in the documented product priority", () => {
    expect([...RECOMMENDATION_SIGNALS]).toEqual([
      "city",
      "university-area",
      "interest",
      "country",
      "saved-category",
      "journey",
      "local",
    ]);
  });

  it("matches an interest the member explicitly selected", () => {
    expect(matchesInterest("Food & Dining", ["Food"])).toBe("Food");
    expect(matchesInterest("Hair & Beauty", ["Hair & Beauty"])).toBe(
      "Hair & Beauty",
    );
  });

  it("does not match on a coincidental short fragment", () => {
    // A two-letter interest must never sweep in unrelated categories.
    expect(matchesInterest("Transport", ["ID"])).toBeNull();
    expect(matchesInterest("Tutoring", [])).toBeNull();
    expect(matchesInterest(null, ["Food"])).toBeNull();
  });
});

describe("recommendation explanations", () => {
  const viewer = {
    cityName: "Jiaxing",
    universityName: "Jiaxing University",
    countryName: "Cameroon",
  };

  it("names the city for a location signal", () => {
    expect(recommendationReason({ signal: "city", ...viewer })).toBe(
      "Recommended because you live in Jiaxing.",
    );
  });

  it("names the university area without revealing an address", () => {
    const reason = recommendationReason({
      signal: "university-area",
      ...viewer,
    });
    expect(reason).toBe("Near your university area in Jiaxing.");
    expect(reason).not.toMatch(/street|road|building|no\.\s*\d/i);
  });

  it("names the country the member selected, transparently", () => {
    expect(recommendationReason({ signal: "country", ...viewer })).toBe(
      "Recommended because you selected Cameroon and currently live in Jiaxing.",
    );
  });

  it("names the interest the member picked", () => {
    expect(
      recommendationReason({ signal: "interest", ...viewer, interest: "Food" }),
    ).toBe("Recommended because you selected Food and live in Jiaxing.");
  });

  it("degrades safely when a signal has no value to name", () => {
    const reason = recommendationReason({
      signal: "city",
      cityName: null,
      universityName: null,
      countryName: null,
    });
    expect(reason).toBe("Available near you.");
  });

  it("always produces a reason the member can check", () => {
    for (const signal of RECOMMENDATION_SIGNALS) {
      const reason = recommendationReason({ signal, ...viewer });
      expect(reason.length).toBeGreaterThan(0);
      expect(reason.endsWith(".")).toBe(true);
    }
  });
});

describe("protected attributes", () => {
  it("never selects a protected attribute from the database", () => {
    // The loader uses an explicit Prisma `select`; assert on that block rather
    // than on prose, so the documentation naming these attributes still passes.
    const select = source.slice(
      source.indexOf("loadRecommendationViewer"),
      source.indexOf("function normalize"),
    );
    for (const field of [
      "gender",
      "ethnicity",
      "religion",
      "nationality",
      "visaStatus",
      "income",
    ]) {
      expect(select).not.toMatch(
        new RegExp(`\\b${field}\\b\\s*:\\s*true`, "i"),
      );
    }
    // The only country read is the one the member selected on their profile.
    expect(select).toContain("country: { select: { name: true } }");
  });

  it("derives a country signal only from the country the member selected", () => {
    // The only country read is the relation on the member's own profile.
    expect(source).toContain("country: { select: { name: true } }");
    expect(source).toContain("countryName");
  });

  it("documents the exclusion so the rule survives future edits", () => {
    expect(source).toContain("SIGNALS NEVER USED");
    // The comment wraps across lines, so collapse whitespace before matching.
    const prose = source.replace(/\s*\*\s*/g, " ").replace(/\s+/g, " ");
    expect(prose).toMatch(
      /hair and beauty services are never recommended from gender/i,
    );
  });
});

describe("no invented content", () => {
  it("never fabricates ratings, distances, urgency or popularity", () => {
    expect(source).not.toMatch(/rating|popularity|responseTime|discount/i);
    expect(source).not.toMatch(/Math\.random/);
  });

  it("passes through only real published price and availability", () => {
    expect(source).toContain("priceLabel: item.priceLabel");
    expect(source).toContain("availabilityLabel: item.availabilityLabel");
    // Students publish no structured price, so nothing is shown for a skill.
    expect(source).toContain("priceLabel: null");
  });

  it("reads each source through its own public projection", () => {
    expect(source).toContain("listPublicCatalog");
    expect(source).toContain("prisma.studentSkillOffer.findMany");
    expect(source).not.toMatch(/prisma\.recommendation/i);
  });

  it("excludes the member's own skill offer", () => {
    expect(source).toContain("ownerId: { not: viewer.id }");
  });

  it("shows only a first name for a student skill", () => {
    expect(source).toContain("publisher: row.owner.firstName");
  });
});
