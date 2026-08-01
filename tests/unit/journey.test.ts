import { describe, expect, it } from "vitest";
import {
  inferJourney,
  isJourneyStageInGroup,
  legacyJourneyFor,
} from "@/lib/journey";

describe("Kondo Journey", () => {
  it("keeps admitted members in Preparing for China", () => {
    expect(legacyJourneyFor("PREPARING_FOR_CHINA", "ADMITTED")).toBe(
      "ADMITTED_STUDENT",
    );
    expect(isJourneyStageInGroup("PREPARING_FOR_CHINA", "ADMITTED")).toBe(true);
    expect(
      isJourneyStageInGroup("STUDYING_AND_LIVING_IN_CHINA", "ADMITTED"),
    ).toBe(false);
  });

  it("infers canonical groups from every legacy journey without mutating data", () => {
    expect(inferJourney({ legacyJourney: "CURRENT_STUDENT" })).toEqual({
      group: "STUDYING_AND_LIVING_IN_CHINA",
      stage: "CURRENT_STUDENT",
    });
    expect(inferJourney({ legacyJourney: "ALUMNI" })).toEqual({
      group: "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
      stage: "ALUMNI",
    });
    expect(inferJourney({ legacyJourney: "ADMITTED_STUDENT" })).toEqual({
      group: "PREPARING_FOR_CHINA",
      stage: "ADMITTED",
    });
  });

  it("rejects a persisted stage that does not belong to its group", () => {
    expect(
      inferJourney({
        group: "PREPARING_FOR_CHINA",
        stage: "EMPLOYED",
        legacyJourney: "PROSPECTIVE_STUDENT",
      }),
    ).toEqual({ group: "PREPARING_FOR_CHINA", stage: "EXPLORING" });
  });
});
