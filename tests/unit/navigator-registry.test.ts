import { describe, expect, it } from "vitest";
import {
  evaluateNavigatorRules,
  NAVIGATOR_ACTION_KEYS,
  NAVIGATOR_RULES,
  type NavigatorContext,
} from "@/features/navigator/registry";

const base: NavigatorContext = {
  guideNextStep: null,
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
    expect(new Set(NAVIGATOR_ACTION_KEYS).size).toBe(
      NAVIGATOR_ACTION_KEYS.length,
    );
    // A computed action is resolved against a context, so it is checked the
    // same way the runtime would see it rather than being skipped.
    for (const rule of NAVIGATOR_RULES) {
      const action =
        typeof rule.action === "function" ? rule.action(base) : rule.action;
      expect(action.href.startsWith("/")).toBe(true);
      expect(action.reason.length).toBeGreaterThan(10);
    }
  });

  it("offers the guide only when a real unfinished step exists", () => {
    expect(
      evaluateNavigatorRules(base).some(({ key }) => key === "continue-guide"),
    ).toBe(false);

    const [action] = evaluateNavigatorRules({
      ...base,
      guideNextStep: {
        guideTitle: "Residence permit",
        stepTitle: "Book your visa appointment",
        completed: 2,
        total: 5,
        href: "/student-hub/guide/residence-permit",
      },
    });
    expect(action?.key).toBe("continue-guide");
    // It names the step and links to the guide, rather than sending the
    // member to a library to find it again themselves.
    expect(action?.title).toContain("Book your visa appointment");
    expect(action?.href).toBe("/student-hub/guide/residence-permit");
    expect(action?.reason).toContain("2 of 5");
    expect(action?.label).toBe("Continue guide");
  });

  it("says start, not continue, when nothing has been done yet", () => {
    const [action] = evaluateNavigatorRules({
      ...base,
      guideNextStep: {
        guideTitle: "Opening a bank account",
        stepTitle: "Gather your documents",
        completed: 0,
        total: 4,
        href: "/student-hub/guide/bank-account",
      },
    });
    expect(action?.label).toBe("Start guide");
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
