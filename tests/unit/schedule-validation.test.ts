import { describe, expect, it } from "vitest";
import type { ExtractedSchedule } from "@/features/student-hub/schemas";
import {
  assessExtractedDocument,
  validateExtractedSchedule,
} from "@/lib/schedule-validation";

function course(
  overrides: Partial<ExtractedSchedule["courses"][number]> = {},
): ExtractedSchedule["courses"][number] {
  return {
    courseName: "International Business",
    teacher: "Dr. Chen",
    dayOfWeek: "MONDAY",
    specificDate: null,
    startPeriod: 1,
    endPeriod: 2,
    startTime: "08:00",
    endTime: "09:30",
    room: "A201",
    building: null,
    campus: null,
    startWeek: 1,
    endWeek: 16,
    weekPattern: "ALL",
    weeks: [],
    language: "English",
    notes: null,
    confidence: 0.94,
    uncertainFields: [],
    ...overrides,
  };
}

describe("timetable quality and structure validation", () => {
  it("rejects genuinely unreadable OCR with an actionable reason", () => {
    expect(assessExtractedDocument({ text: " 1 l ", confidence: 6 })).toEqual(
      expect.objectContaining({
        ok: false,
        code: "DOCUMENT_TOO_BLURRY",
      }),
    );
  });

  it("accepts multilingual timetable signals", () => {
    expect(
      assessExtractedDocument({
        text: "星期一 第1-2节 国际商务 教室 A201 1-16周",
        confidence: 72,
      }),
    ).toEqual(expect.objectContaining({ ok: true }));
  });

  it("treats teacher and classroom as optional while detecting duplicates and overlaps", () => {
    const result = validateExtractedSchedule({
      title: "Semester schedule",
      warnings: [],
      courses: [
        course({ teacher: null, room: null }),
        course(),
        course({
          courseName: "Academic Writing",
          startTime: "09:00",
          endTime: "10:30",
          startPeriod: 2,
          endPeriod: 3,
        }),
      ],
    });

    expect(result.diagnostics.duplicatePairs).toEqual([[0, 1]]);
    expect(result.diagnostics.conflictPairs).toEqual([
      [0, 2],
      [1, 2],
    ]);
    expect(result.schedule.courses[0].uncertainFields).not.toContain("teacher");
    expect(result.schedule.courses[0].uncertainFields).not.toContain("room");
    expect(result.schedule.warnings.join(" ")).toMatch(/duplicate/i);
    expect(result.schedule.warnings.join(" ")).toMatch(/conflict/i);
  });

  it("keeps period-only courses reviewable when a university has no period configuration", () => {
    const result = validateExtractedSchedule(
      {
        title: "Imported timetable",
        warnings: [],
        courses: [
          course({
            startPeriod: 3,
            endPeriod: 4,
            startTime: null,
            endTime: null,
          }),
        ],
      },
      { periodConfigurationAvailable: false, configuredPeriodNumbers: [] },
    );

    expect(result.schedule.courses[0]?.uncertainFields).toContain("time");
    expect(result.schedule.warnings.join(" ")).toContain(
      "timetable periods are not configured",
    );
  });

  it("flags period numbers that are absent from the university configuration", () => {
    const result = validateExtractedSchedule(
      {
        title: "Imported timetable",
        warnings: [],
        courses: [course({ startPeriod: 9, endPeriod: 10 })],
      },
      {
        periodConfigurationAvailable: true,
        configuredPeriodNumbers: [1, 2, 3, 4],
      },
    );

    expect(result.schedule.courses[0]?.uncertainFields).toEqual(
      expect.arrayContaining(["startPeriod", "endPeriod"]),
    );
    expect(result.schedule.warnings.join(" ")).toContain("Unknown period 9");
  });
});
