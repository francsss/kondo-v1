import { describe, expect, it } from "vitest";
import {
  evaluateNavigatorRules,
  NAVIGATOR_RULES,
  type NavigatorContext,
} from "@/features/navigator/registry";

const base: NavigatorContext = {
  group: "PREPARING_FOR_CHINA",
  stage: "EXPLORING",
  profileComplete: true,
  communityMembershipCount: 1,
  publicCommunityCount: 5,
  scholarshipCount: 0,
  internshipCount: 0,
  jobCount: 0,
  housingCount: 0,
  essentialCount: 0,
  opportunityDocumentCount: 0,
  professionalProfileComplete: false,
  activeApplicationActionCount: 0,
  scheduleCount: 1,
};

describe("Kondo Navigator rule registry", () => {
  it("uses stable unique keys and internal routes only", () => {
    const keys = NAVIGATOR_RULES.map(({ action }) => action.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const { action } of NAVIGATOR_RULES) {
      expect(action.href.startsWith("/")).toBe(true);
      expect(action.reason.length).toBeGreaterThan(10);
    }
  });

  it("does not invent an action when the source domain has no real records", () => {
    expect(evaluateNavigatorRules(base)).toEqual([]);
  });

  it("prioritizes actions requiring attention before recommendations", () => {
    const actions = evaluateNavigatorRules({
      ...base,
      profileComplete: false,
      scholarshipCount: 4,
    });
    expect(actions[0]?.key).toBe("complete-profile");
    expect(actions[0]?.priority).toBe("REQUIRED");
    expect(actions[1]?.key).toBe("explore-scholarships");
  });

  it("shows housing only after admission and only when housing exists", () => {
    expect(
      evaluateNavigatorRules({ ...base, housingCount: 3 }).some(
        ({ key }) => key === "prepare-housing",
      ),
    ).toBe(false);
    expect(
      evaluateNavigatorRules({
        ...base,
        stage: "ADMITTED",
        housingCount: 3,
      }).some(({ key }) => key === "prepare-housing"),
    ).toBe(true);
  });
});
