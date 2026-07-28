import { describe, expect, it } from "vitest";
import { scheduleImportConfirmSchema } from "@/features/student-hub/schemas";
import { normalizeScheduleExtractionCandidate } from "@/lib/schedule-extraction-normalization";
import { describeTimetableValidation } from "@/lib/schedule-validation-errors";

function persistenceCourse(overrides: Record<string, unknown> = {}) {
  return {
    courseName: "高等数学",
    teacher: null,
    dayOfWeek: 1,
    specificDate: null,
    startPeriod: 1,
    endPeriod: 2,
    startTime: "",
    endTime: "",
    room: null,
    building: null,
    campusLabel: null,
    startWeek: 1,
    endWeek: 16,
    weekPattern: "ALL",
    weeks: [],
    language: "zh-CN",
    notes: null,
    color: "#22A06B",
    isOptional: false,
    confidence: 0.91,
    source: "IMPORT",
    ...overrides,
  };
}

describe("timetable confirmation validation", () => {
  it("accepts a real period-only university course and normalizes blank times", () => {
    const result = scheduleImportConfirmSchema.parse({
      title: "春季课表",
      courses: [persistenceCourse()],
    });

    expect(result.courses[0]).toMatchObject({
      startPeriod: 1,
      endPeriod: 2,
      startTime: null,
      endTime: null,
    });
  });

  it("accepts a clock-time course when no period numbers exist", () => {
    expect(
      scheduleImportConfirmSchema.safeParse({
        title: "English timetable",
        courses: [
          persistenceCourse({
            startPeriod: null,
            endPeriod: null,
            startTime: "8:00",
            endTime: "09:30",
          }),
        ],
      }).success,
    ).toBe(false);

    expect(
      scheduleImportConfirmSchema.safeParse({
        title: "English timetable",
        courses: [
          persistenceCourse({
            startPeriod: null,
            endPeriod: null,
            startTime: "08:00",
            endTime: "09:30",
          }),
        ],
      }).success,
    ).toBe(true);
  });

  it("returns an actionable error only when both time and periods are absent", () => {
    const result = scheduleImportConfirmSchema.safeParse({
      title: "Imported timetable",
      courses: [
        persistenceCourse({
          startPeriod: null,
          endPeriod: null,
          startTime: "",
          endTime: "",
        }),
      ],
    });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(describeTimetableValidation(result.error)).toEqual(
      expect.objectContaining({
        code: "TIMETABLE_VALIDATION_FAILED",
        message: expect.stringContaining(
          "clock-time range or a complete period-number range",
        ),
      }),
    );
  });
});

describe("DeepSeek timetable response normalization", () => {
  it("normalizes Chinese weekdays, period ranges, week ranges and percentages", () => {
    expect(
      normalizeScheduleExtractionCandidate({
        timetable: {
          title: "2026 春季学期",
          classes: [
            {
              subject: "大学物理",
              instructor: "王老师",
              weekday: "星期三",
              periods: "第3-4节",
              weekRange: "1-16周",
              classroom: "A201",
              confidence: "92%",
            },
          ],
        },
      }),
    ).toEqual({
      title: "2026 春季学期",
      warnings: [],
      courses: [
        expect.objectContaining({
          courseName: "大学物理",
          teacher: "王老师",
          dayOfWeek: "WEDNESDAY",
          startPeriod: 3,
          endPeriod: 4,
          startTime: null,
          endTime: null,
          startWeek: 1,
          endWeek: 16,
          weekPattern: "ALL",
          weeks: [],
          room: "A201",
          confidence: 0.92,
        }),
      ],
    });
  });

  it("normalizes English time ranges and explicit custom weeks", () => {
    expect(
      normalizeScheduleExtractionCandidate({
        schedule: {
          name: "Semester 2",
          subjects: [
            {
              name: "Academic Writing",
              day: "Tue",
              timeRange: "8:00 - 09:30",
              weekNumbers: [1, 3, 5],
            },
          ],
        },
      }),
    ).toEqual({
      title: "Semester 2",
      warnings: [],
      courses: [
        expect.objectContaining({
          courseName: "Academic Writing",
          dayOfWeek: "TUESDAY",
          startTime: "08:00",
          endTime: "09:30",
          weekPattern: "CUSTOM",
          weeks: [1, 3, 5],
        }),
      ],
    });
  });
});
