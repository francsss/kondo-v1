export type AcademicCourseTime = {
  id: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  startPeriod: number | null;
  endPeriod: number | null;
};

const WEEKDAY_NUMBER: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function timeToMinutes(value: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function zonedAcademicClock(date: Date, timezone = "Asia/Shanghai") {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return {
    dayOfWeek: WEEKDAY_NUMBER[parts.weekday ?? ""] ?? 1,
    minutes: Number(parts.hour ?? 0) * 60 + Number(parts.minute ?? 0),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function deriveTodayCourses<T extends AcademicCourseTime>(
  courses: T[],
  now = new Date(),
  timezone = "Asia/Shanghai",
) {
  const clock = zonedAcademicClock(now, timezone);
  const today = courses
    .filter((course) => course.dayOfWeek === clock.dayOfWeek)
    .sort((left, right) => {
      const leftTime =
        timeToMinutes(left.startTime) ?? (left.startPeriod ?? 99) * 60;
      const rightTime =
        timeToMinutes(right.startTime) ?? (right.startPeriod ?? 99) * 60;
      return leftTime - rightTime;
    });
  const current =
    today.find((course) => {
      const start = timeToMinutes(course.startTime);
      const end = timeToMinutes(course.endTime);
      return start !== null && end !== null
        ? start <= clock.minutes && clock.minutes < end
        : false;
    }) ?? null;
  const next =
    today.find((course) => {
      const start = timeToMinutes(course.startTime);
      return start !== null && start > clock.minutes;
    }) ?? null;
  return { clock, today, current, next };
}

export function startOfAcademicWeek(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return start;
}

export function academicWeekDates(anchor: Date) {
  const start = startOfAcademicWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function academicCalendarPosition(
  course: Pick<AcademicCourseTime, "startTime" | "endTime">,
  dayStartsAtMinutes = 8 * 60,
  dayEndsAtMinutes = 18 * 60,
) {
  const start = timeToMinutes(course.startTime);
  const end = timeToMinutes(course.endTime);
  if (start === null || end === null || end <= start) return null;
  const total = dayEndsAtMinutes - dayStartsAtMinutes;
  const boundedStart = Math.max(dayStartsAtMinutes, start);
  const boundedEnd = Math.min(dayEndsAtMinutes, end);
  return {
    top: ((boundedStart - dayStartsAtMinutes) / total) * 100,
    height: Math.max(7, ((boundedEnd - boundedStart) / total) * 100),
  };
}

export function isPendingAcademicTask(task: {
  status: string;
  dueAt: string | null;
}) {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED";
}
