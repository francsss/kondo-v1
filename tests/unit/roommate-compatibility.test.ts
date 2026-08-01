import { describe, expect, it } from "vitest";
import {
  budgetsOverlap,
  type CompatibilityProfile,
  describeRoommateExclusions,
  MOVE_IN_TOLERANCE_DAYS,
  roommateCompatibility,
  roommateEligibility,
  ROOMMATE_SCORING_CRITERIA,
} from "@/lib/roommate-compatibility";

const NOW = new Date("2026-03-01T00:00:00.000Z");

function profile(
  overrides: Partial<CompatibilityProfile> = {},
): CompatibilityProfile {
  return {
    id: "profile-1",
    userId: "user-1",
    status: "ACTIVE",
    visibility: "MEMBERS_ONLY",
    allowInterests: true,
    expiresAt: null,
    moveInDate: new Date("2026-04-01T00:00:00.000Z"),
    stayDurationMonths: 12,
    budgetMinimumMinor: null,
    budgetMaximumMinor: 300_000,
    currency: "CNY",
    preferredHousingTypes: ["PRIVATE_ROOM"],
    languages: ["English", "French"],
    sleepSchedule: "EARLY",
    routine: "STUDENT",
    cleanlinessPreference: "TIDY",
    cookingFrequency: "OFTEN",
    smokingPreference: "NOT_ALLOWED",
    petPreference: "NOT_ALLOWED",
    guestPreference: "RARELY",
    noisePreference: "QUIET",
    city: { id: "city-1", name: "Beijing" },
    university: { id: "uni-1", name: "Tsinghua" },
    user: { id: "user-1", status: "ACTIVE" },
    ...overrides,
  };
}

const viewer = profile({ id: "viewer", userId: "viewer-user" });

function eligibility(candidate: CompatibilityProfile, blocked = false) {
  return roommateEligibility({ viewer, candidate, blocked, now: NOW });
}

describe("roommate budget overlap", () => {
  it("treats a missing minimum as no lower bound", () => {
    // The roommate form only collects a maximum, so almost every real profile
    // has a null minimum. Comparing null directly is what made compatible
    // profiles vanish from budget-filtered searches.
    expect(
      budgetsOverlap(
        { budgetMinimumMinor: null, budgetMaximumMinor: 300_000 },
        { budgetMinimumMinor: null, budgetMaximumMinor: 250_000 },
      ),
    ).toBe(true);
  });

  it("still refuses genuinely disjoint ranges", () => {
    expect(
      budgetsOverlap(
        { budgetMinimumMinor: 400_000, budgetMaximumMinor: 600_000 },
        { budgetMinimumMinor: null, budgetMaximumMinor: 200_000 },
      ),
    ).toBe(false);
  });

  it("is symmetric", () => {
    const a = { budgetMinimumMinor: 100_000, budgetMaximumMinor: 300_000 };
    const b = { budgetMinimumMinor: 250_000, budgetMaximumMinor: 500_000 };
    expect(budgetsOverlap(a, b)).toBe(budgetsOverlap(b, a));
  });
});

describe("roommate eligibility", () => {
  it("accepts a compatible active candidate", () => {
    expect(eligibility(profile())).toBeNull();
  });

  it("never lists the viewer's own profile", () => {
    expect(eligibility(profile({ userId: viewer.userId }))?.key).toBe("self");
  });

  it("excludes a blocked relationship in either direction", () => {
    expect(eligibility(profile(), true)?.key).toBe("blocked");
  });

  it("excludes paused and inactive profiles", () => {
    expect(eligibility(profile({ status: "PAUSED" }))?.key).toBe(
      "active-profile",
    );
    expect(eligibility(profile({ status: "INACTIVE" }))?.key).toBe(
      "active-profile",
    );
  });

  it("excludes private profiles", () => {
    expect(eligibility(profile({ visibility: "PRIVATE" }))?.key).toBe(
      "visible-profile",
    );
  });

  it("excludes expired profiles", () => {
    expect(
      eligibility(profile({ expiresAt: new Date("2026-02-01T00:00:00Z") }))
        ?.key,
    ).toBe("not-expired");
  });

  it("excludes suspended members", () => {
    expect(
      eligibility(profile({ user: { id: "user-1", status: "SUSPENDED" } }))
        ?.key,
    ).toBe("active-user");
  });

  it("excludes a different city", () => {
    expect(
      eligibility(profile({ city: { id: "city-2", name: "Shanghai" } }))?.key,
    ).toBe("city");
  });

  it("excludes move-in dates beyond the tolerance but keeps those inside it", () => {
    const inside = new Date(
      viewer.moveInDate.getTime() + (MOVE_IN_TOLERANCE_DAYS - 1) * 86_400_000,
    );
    const outside = new Date(
      viewer.moveInDate.getTime() + (MOVE_IN_TOLERANCE_DAYS + 1) * 86_400_000,
    );
    expect(eligibility(profile({ moveInDate: inside }))).toBeNull();
    expect(eligibility(profile({ moveInDate: outside }))?.key).toBe("move-in");
  });

  it("excludes non-overlapping budgets in the same currency", () => {
    expect(
      eligibility(
        profile({ budgetMinimumMinor: 900_000, budgetMaximumMinor: 1_200_000 }),
      )?.key,
    ).toBe("budget");
  });

  it("does not exclude on budget across different currencies", () => {
    expect(
      eligibility(
        profile({
          currency: "USD",
          budgetMinimumMinor: 900_000,
          budgetMaximumMinor: 1_200_000,
        }),
      ),
    ).toBeNull();
  });

  it("applies no viewer-relative rule when the member has no profile", () => {
    expect(
      roommateEligibility({
        viewer: null,
        candidate: profile({ city: { id: "city-9", name: "Chengdu" } }),
        blocked: false,
        now: NOW,
      }),
    ).toBeNull();
  });
});

describe("roommate compatibility scoring", () => {
  it("scores two aligned profiles highly and explains why", () => {
    const result = roommateCompatibility(viewer, profile());
    expect(result.score).toBe(100);
    expect(result.matched.length).toBeGreaterThanOrEqual(4);
    expect(result.explanation).toMatch(/^100% compatible — /);
  });

  it("counts at least four shared preferences for the reported scenario", () => {
    // Same city, same move-in window, overlapping budget, shared language.
    const candidate = profile({
      university: null,
      sleepSchedule: null,
      routine: null,
      cleanlinessPreference: null,
      cookingFrequency: null,
      guestPreference: null,
      noisePreference: null,
      smokingPreference: "NOT_SPECIFIED",
      petPreference: "NOT_SPECIFIED",
    });
    const result = roommateCompatibility(viewer, candidate);
    const keys = result.matched.map((entry) => entry.key);
    expect(keys).toContain("city");
    expect(keys).toContain("move-in");
    expect(keys).toContain("budget");
    expect(keys).toContain("languages");
    expect(result.matched.length).toBeGreaterThanOrEqual(4);
  });

  it("ignores criteria neither side answered instead of penalising them", () => {
    const sparse = profile({
      sleepSchedule: null,
      cleanlinessPreference: null,
      routine: null,
    });
    const sparseViewer = { ...viewer, sleepSchedule: null, routine: null };
    const result = roommateCompatibility(sparseViewer, sparse);
    expect(result.notComparable).toContain("sleep-schedule");
    expect(result.notComparable).toContain("routine");
    // Cleanliness is answered by the viewer only, so it is also not comparable.
    expect(result.notComparable).toContain("cleanliness");
    expect(result.score).toBeGreaterThan(0);
  });

  it("reports disagreements as excluded criteria", () => {
    const result = roommateCompatibility(
      viewer,
      profile({ cleanlinessPreference: "RELAXED", sleepSchedule: "LATE" }),
    );
    const excluded = result.excluded.map((entry) => entry.key);
    expect(excluded).toContain("cleanliness");
    expect(excluded).toContain("sleep-schedule");
    expect(result.score).toBeLessThan(100);
  });

  it("is deterministic for the same input", () => {
    const candidate = profile({ cleanlinessPreference: "RELAXED" });
    const first = roommateCompatibility(viewer, candidate);
    const second = roommateCompatibility(viewer, candidate);
    expect(first).toEqual(second);
  });

  it("never scores on a protected attribute", () => {
    const keys = ROOMMATE_SCORING_CRITERIA.map((entry) => entry.key);
    expect(keys).not.toContain("gender");
    expect(keys).not.toContain("genderPreference");
    expect(keys).not.toContain("nationality");
  });

  it("invites a member without a profile to create one", () => {
    const result = roommateCompatibility(null, profile());
    expect(result.score).toBe(0);
    expect(result.explanation).toMatch(/Create your roommate profile/);
  });
});

describe("empty-state explanation", () => {
  it("states the real reasons candidates were removed", () => {
    const message = describeRoommateExclusions([
      {
        key: "budget",
        summary: "Some profiles have budgets that do not overlap with yours.",
      },
      {
        key: "city",
        summary: "Some profiles are searching in a different city.",
      },
    ]);
    expect(message).toContain("budgets that do not overlap");
    expect(message).toContain("different city");
  });

  it("never claims exclusions that did not happen", () => {
    expect(describeRoommateExclusions([])).toMatch(
      /New roommate profiles appear here/,
    );
  });

  it("does not report the viewer's own profile as an exclusion", () => {
    const message = describeRoommateExclusions([
      { key: "self", summary: "Your own profile is never listed." },
    ]);
    expect(message).not.toContain("Your own profile");
  });
});
