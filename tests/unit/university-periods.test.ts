import { describe, expect, it } from "vitest";
import { periodConfigurationSchema } from "@/features/student-hub/schemas";
import {
  calculateUniversityPeriodEnd,
  deriveUniversityPeriodDuration,
  validateUniversityPeriodDrafts,
} from "@/lib/university-periods";

describe("university period configuration", () => {
  it("derives each end time from its own duration", () => {
    expect(calculateUniversityPeriodEnd("08:00", 40)).toBe("08:40");
    expect(calculateUniversityPeriodEnd("08:50", 45)).toBe("09:35");
    expect(calculateUniversityPeriodEnd("10:00", 90)).toBe("11:30");
    expect(deriveUniversityPeriodDuration("10:00", "11:30")).toBe(90);
  });

  it("rejects duplicate numbers and overlapping ranges", () => {
    const issues = validateUniversityPeriodDrafts([
      { periodNumber: 1, startTime: "08:00", durationMinutes: 50 },
      { periodNumber: 1, startTime: "08:40", durationMinutes: 45 },
    ]);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_PERIOD", "OVERLAPPING_PERIODS"]),
    );
  });

  it("allows adjacent periods with different durations", () => {
    expect(
      validateUniversityPeriodDrafts([
        { periodNumber: 1, startTime: "08:00", durationMinutes: 35 },
        { periodNumber: 2, startTime: "08:35", durationMinutes: 60 },
      ]),
    ).toEqual([]);
  });

  it("enforces impossible-value and overlap validation at the API schema", () => {
    const base = {
      campusId: null,
      name: "Official periods",
      timezone: "Asia/Shanghai",
      primaryLanguage: "zh-CN",
      isActive: true,
      isDefault: true,
    };
    const overlapping = periodConfigurationSchema.safeParse({
      ...base,
      periods: [
        {
          periodNumber: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "09:00",
          displayOrder: 1,
          isBreak: false,
          isActive: true,
        },
        {
          periodNumber: 2,
          label: "Period 2",
          startTime: "08:30",
          endTime: "09:15",
          displayOrder: 2,
          isBreak: false,
          isActive: true,
        },
      ],
    });
    expect(overlapping.success).toBe(false);
    if (!overlapping.success) {
      expect(
        overlapping.error.issues.some((issue) =>
          issue.message.includes("overlaps"),
        ),
      ).toBe(true);
    }

    const impossibleDuration = periodConfigurationSchema.safeParse({
      ...base,
      periods: [
        {
          periodNumber: 1,
          label: "Period 1",
          startTime: "08:00",
          endTime: "13:00",
          displayOrder: 1,
          isBreak: false,
          isActive: true,
        },
      ],
    });
    expect(impossibleDuration.success).toBe(false);
  });
});
