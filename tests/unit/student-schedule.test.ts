import { describe, expect, it } from "vitest";
import {
  findScheduleConflicts,
  normalizeExtractedSchedule,
  schedulesOverlap,
} from "@/lib/student-schedule";

const course = (
  overrides: Partial<{
    id: string;
    courseName: string;
    dayOfWeek: number;
    startPeriod: number | null;
    endPeriod: number | null;
    startTime: string | null;
    endTime: string | null;
    startWeek: number | null;
    endWeek: number | null;
    weekPattern: "ALL" | "ODD" | "EVEN" | "CUSTOM";
    weeks: number[];
  }> = {},
) => ({
  id: "course-a",
  courseName: "Chinese",
  dayOfWeek: 1,
  startPeriod: null,
  endPeriod: null,
  startTime: "08:00",
  endTime: "09:30",
  startWeek: 1,
  endWeek: 16,
  weekPattern: "ALL" as const,
  weeks: [],
  ...overrides,
});

describe("student timetable normalization", () => {
  it("converts numbered Chinese periods to official university times", () => {
    const normalized = normalizeExtractedSchedule(
      {
        title: "春季课表",
        warnings: [],
        courses: [
          {
            courseName: "高等数学",
            teacher: "王老师",
            dayOfWeek: "MONDAY",
            specificDate: null,
            startPeriod: 1,
            endPeriod: 2,
            startTime: null,
            endTime: null,
            room: "A-201",
            building: null,
            campus: "Main",
            startWeek: 1,
            endWeek: 16,
            weekPattern: "ALL",
            weeks: [],
            language: "zh-CN",
            notes: null,
            confidence: 0.94,
            uncertainFields: [],
          },
        ],
      },
      [
        { periodNumber: 1, startTime: "08:00", endTime: "08:45" },
        { periodNumber: 2, startTime: "08:55", endTime: "09:40" },
      ],
    );
    expect(normalized.courses[0]).toMatchObject({
      courseName: "高等数学",
      dayOfWeek: 1,
      startTime: "08:00",
      endTime: "09:40",
      startWeek: 1,
      endWeek: 16,
      weekPattern: "ALL",
    });
    expect(normalized.courses[0]?.uncertainFields).toEqual([]);
  });

  it("marks time for review when numbered periods have no official mapping", () => {
    const normalized = normalizeExtractedSchedule(
      {
        title: null,
        warnings: [],
        courses: [
          {
            courseName: "Physics",
            teacher: null,
            dayOfWeek: "TUESDAY",
            specificDate: null,
            startPeriod: 3,
            endPeriod: 4,
            startTime: null,
            endTime: null,
            room: null,
            building: null,
            campus: null,
            startWeek: null,
            endWeek: null,
            weekPattern: "ODD",
            weeks: [],
            language: null,
            notes: null,
            confidence: 0.7,
            uncertainFields: [],
          },
        ],
      },
      [],
    );
    expect(normalized.courses[0]?.uncertainFields).toContain("time");
    expect(normalized.courses[0]).toMatchObject({
      startPeriod: 3,
      endPeriod: 4,
      startTime: null,
      endTime: null,
    });
  });

  it("understands odd, even and custom recurrence when detecting conflicts", () => {
    const odd = course({ id: "odd", weekPattern: "ODD" });
    const even = course({ id: "even", weekPattern: "EVEN" });
    const custom = course({
      id: "custom",
      weekPattern: "CUSTOM",
      weeks: [3, 7],
    });
    expect(schedulesOverlap(odd, even)).toBe(false);
    expect(schedulesOverlap(odd, custom)).toBe(true);
    expect(findScheduleConflicts([odd, custom])).toEqual([
      {
        firstId: "odd",
        secondId: "custom",
        message: "Chinese conflicts with Chinese on Monday (08:00–09:30).",
      },
    ]);
  });

  it("detects overlapping period-only courses without inventing clock times", () => {
    const first = course({
      id: "period-a",
      startTime: null,
      endTime: null,
      startPeriod: 1,
      endPeriod: 2,
    });
    const second = course({
      id: "period-b",
      courseName: "Physics",
      startTime: null,
      endTime: null,
      startPeriod: 2,
      endPeriod: 3,
    });

    expect(schedulesOverlap(first, second)).toBe(true);
    expect(findScheduleConflicts([first, second])[0]?.message).toContain(
      "Periods 1–2",
    );
  });
});
