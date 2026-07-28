import type { ScheduleCourse } from "@prisma/client";
import type { ExtractedSchedule } from "@/features/student-hub/schemas";

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const DAY_NUMBERS: Record<string, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};

type Period = {
  periodNumber: number;
  startTime: string;
  endTime: string;
};

export function normalizeExtractedSchedule(
  extraction: ExtractedSchedule,
  periods: Period[],
) {
  const periodMap = new Map(
    periods.map((period) => [period.periodNumber, period]),
  );
  const colors = [
    "#22A06B",
    "#3B82F6",
    "#8B5CF6",
    "#F59E0B",
    "#EF6C57",
    "#06B6D4",
  ];
  return {
    title: extraction.title || "My timetable",
    warnings: extraction.warnings,
    courses: extraction.courses.map((course, index) => {
      const startPeriod = course.startPeriod
        ? periodMap.get(course.startPeriod)
        : null;
      const endPeriod = course.endPeriod
        ? periodMap.get(course.endPeriod)
        : null;
      const startTime = course.startTime ?? startPeriod?.startTime ?? null;
      const endTime = course.endTime ?? endPeriod?.endTime ?? null;
      const uncertainFields = [...course.uncertainFields];
      if (!startTime || !endTime) uncertainFields.push("time");
      return {
        courseName: course.courseName,
        teacher: course.teacher,
        dayOfWeek: DAY_NUMBERS[course.dayOfWeek],
        specificDate: course.specificDate,
        startPeriod: course.startPeriod,
        endPeriod: course.endPeriod,
        startTime,
        endTime,
        room: course.room,
        building: course.building,
        campusLabel: course.campus,
        startWeek: course.startWeek,
        endWeek: course.endWeek,
        weekPattern: course.weekPattern,
        weeks: course.weeks,
        language: course.language,
        notes: course.notes,
        confidence: course.confidence,
        uncertainFields: [...new Set(uncertainFields)],
        color: colors[index % colors.length],
        isOptional: false,
        source: "IMPORT" as const,
      };
    }),
  };
}

type ConflictCourse = Pick<
  ScheduleCourse,
  | "id"
  | "courseName"
  | "dayOfWeek"
  | "startPeriod"
  | "endPeriod"
  | "startTime"
  | "endTime"
  | "startWeek"
  | "endWeek"
  | "weekPattern"
  | "weeks"
>;

function comparableCourseWindow(course: ConflictCourse) {
  if (course.startTime && course.endTime) {
    return {
      kind: "time" as const,
      start: course.startTime,
      end: course.endTime,
    };
  }
  if (course.startPeriod !== null && course.endPeriod !== null) {
    return {
      kind: "period" as const,
      start: String(course.startPeriod).padStart(2, "0"),
      end: String(course.endPeriod + 1).padStart(2, "0"),
    };
  }
  return null;
}

function weekSet(course: ConflictCourse) {
  if (course.weekPattern === "CUSTOM") return new Set(course.weeks);
  const start = course.startWeek ?? 1;
  const end = course.endWeek ?? 60;
  const weeks: number[] = [];
  for (let week = start; week <= end; week += 1) {
    if (course.weekPattern === "ODD" && week % 2 === 0) continue;
    if (course.weekPattern === "EVEN" && week % 2 !== 0) continue;
    weeks.push(week);
  }
  return new Set(weeks);
}

export function schedulesOverlap(a: ConflictCourse, b: ConflictCourse) {
  if (a.dayOfWeek !== b.dayOfWeek) return false;
  const aWindow = comparableCourseWindow(a);
  const bWindow = comparableCourseWindow(b);
  if (
    !aWindow ||
    !bWindow ||
    aWindow.kind !== bWindow.kind ||
    !(aWindow.start < bWindow.end && bWindow.start < aWindow.end)
  ) {
    return false;
  }
  const aWeeks = weekSet(a);
  return [...weekSet(b)].some((week) => aWeeks.has(week));
}

export function formatCourseTime(
  course: Pick<
    ConflictCourse,
    "startTime" | "endTime" | "startPeriod" | "endPeriod"
  >,
) {
  if (course.startTime && course.endTime) {
    return `${course.startTime}–${course.endTime}`;
  }
  if (course.startPeriod !== null && course.endPeriod !== null) {
    return course.startPeriod === course.endPeriod
      ? `Period ${course.startPeriod}`
      : `Periods ${course.startPeriod}–${course.endPeriod}`;
  }
  return "Time to confirm";
}

export function findScheduleConflicts(courses: ConflictCourse[]) {
  const conflicts: Array<{
    firstId: string;
    secondId: string;
    message: string;
  }> = [];
  for (let first = 0; first < courses.length; first += 1) {
    for (let second = first + 1; second < courses.length; second += 1) {
      const a = courses[first];
      const b = courses[second];
      if (!a || !b || !schedulesOverlap(a, b)) continue;
      conflicts.push({
        firstId: a.id,
        secondId: b.id,
        message: `${a.courseName} conflicts with ${b.courseName} on ${DAY_NAMES[a.dayOfWeek - 1]} (${formatCourseTime(a)}).`,
      });
    }
  }
  return conflicts;
}

export function courseOccursInWeek(course: ConflictCourse, week: number) {
  return weekSet(course).has(week);
}
