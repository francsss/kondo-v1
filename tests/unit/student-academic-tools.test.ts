import { describe, expect, it } from "vitest";
import {
  academicCalendarPosition,
  academicWeekDates,
  deriveTodayCourses,
  isPendingAcademicTask,
  timeToMinutes,
  zonedAcademicClock,
} from "@/lib/student-academic-tools";

const courses = [
  {
    id: "morning",
    dayOfWeek: 1,
    startTime: "08:00",
    endTime: "09:30",
    startPeriod: 1,
    endPeriod: 2,
  },
  {
    id: "afternoon",
    dayOfWeek: 1,
    startTime: "14:00",
    endTime: "15:30",
    startPeriod: 7,
    endPeriod: 8,
  },
  {
    id: "tuesday",
    dayOfWeek: 2,
    startTime: "10:00",
    endTime: "11:30",
    startPeriod: 3,
    endPeriod: 4,
  },
];

describe("Student Hub Academic OS derivations", () => {
  it("derives the current and next class in the schedule timezone", () => {
    const now = new Date("2026-07-27T00:30:00.000Z"); // Monday 08:30 in China.
    const result = deriveTodayCourses(courses, now, "Asia/Shanghai");

    expect(result.clock).toMatchObject({ dayOfWeek: 1, minutes: 510 });
    expect(result.today.map((course) => course.id)).toEqual([
      "morning",
      "afternoon",
    ]);
    expect(result.current?.id).toBe("morning");
    expect(result.next?.id).toBe("afternoon");
  });

  it("uses Monday as the beginning of every academic week", () => {
    const dates = academicWeekDates(new Date("2026-07-30T12:00:00.000Z"));
    expect(dates).toHaveLength(7);
    expect(dates[0]?.getDay()).toBe(1);
    expect(dates[6]?.getDay()).toBe(0);
  });

  it("computes stable calendar positions from confirmed clock times", () => {
    expect(timeToMinutes("08:45")).toBe(525);
    expect(academicCalendarPosition(courses[0]!)).toEqual({
      top: 0,
      height: 15,
    });
    expect(
      academicCalendarPosition({
        startTime: null,
        endTime: null,
      }),
    ).toBeNull();
  });

  it("keeps undated academic work visible as pending", () => {
    expect(isPendingAcademicTask({ status: "PENDING", dueAt: null })).toBe(
      true,
    );
    expect(isPendingAcademicTask({ status: "COMPLETED", dueAt: null })).toBe(
      false,
    );
  });

  it("returns a deterministic China academic clock", () => {
    expect(
      zonedAcademicClock(new Date("2026-07-28T04:15:00.000Z"), "Asia/Shanghai"),
    ).toEqual({
      dayOfWeek: 2,
      minutes: 735,
      dateKey: "2026-07-28",
    });
  });
});
