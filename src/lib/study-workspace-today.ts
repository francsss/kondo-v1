import { prisma } from "@/lib/prisma";
import { deriveTodayCourses } from "@/lib/student-academic-tools";

/**
 * What the student needs to study right now.
 *
 * Workspace owns no data. The timetable is `StudentSchedule`, the courses are
 * `ScheduleCourse` and the work is `AcademicTask` — all of which already exist
 * and already relate to each other (`AcademicTask.courseId`). This projects
 * them for one screen; it does not copy them.
 *
 * It is deliberately one query. The brief warns against a Workspace where the
 * schedule loads, then tasks load, then materials load — so courses and their
 * open tasks come back together, and nothing else is fetched until the student
 * asks for it.
 */

export type WorkspaceTask = {
  id: string;
  title: string;
  dueAt: Date | null;
  kind: string;
  priority: string;
};

export type WorkspaceCourse = {
  id: string;
  courseName: string;
  teacher: string | null;
  room: string | null;
  building: string | null;
  startTime: string | null;
  endTime: string | null;
  dayOfWeek: number;
  color: string;
  tasks: WorkspaceTask[];
};

const OPEN_TASK_STATUSES: ("PENDING" | "IN_PROGRESS")[] = [
  "PENDING",
  "IN_PROGRESS",
];

const COURSE_SELECT = {
  id: true,
  courseName: true,
  teacher: true,
  room: true,
  building: true,
  startTime: true,
  endTime: true,
  startPeriod: true,
  endPeriod: true,
  dayOfWeek: true,
  color: true,
  tasks: {
    where: { status: { in: OPEN_TASK_STATUSES } },
    orderBy: [{ dueAt: "asc" as const }, { createdAt: "asc" as const }],
    take: 3,
    select: {
      id: true,
      title: true,
      dueAt: true,
      kind: true,
      priority: true,
    },
  },
};

export async function getWorkspaceToday(userId: string, now = new Date()) {
  const schedule = await prisma.studentSchedule.findFirst({
    where: { ownerId: userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      timezone: true,
      courses: { select: COURSE_SELECT },
    },
  });

  if (!schedule) {
    return {
      schedule: null,
      clock: null,
      today: [] as WorkspaceCourse[],
      current: null,
      next: null,
      courseCount: 0,
    };
  }

  // The same helper the Planner and Overview already use, so "today" means
  // the same thing everywhere — including its timezone handling.
  const { clock, today, current, next } = deriveTodayCourses(
    schedule.courses,
    now,
    schedule.timezone,
  );

  return {
    schedule: { id: schedule.id, title: schedule.title },
    clock,
    today: today as WorkspaceCourse[],
    current: (current as WorkspaceCourse | null) ?? null,
    next: (next as WorkspaceCourse | null) ?? null,
    courseCount: schedule.courses.length,
  };
}

export async function getWorkspaceCourse(userId: string, courseId: string) {
  // Ownership is enforced through the schedule, not trusted from the URL.
  return prisma.scheduleCourse.findFirst({
    where: { id: courseId, schedule: { ownerId: userId } },
    select: { ...COURSE_SELECT, notes: true, language: true },
  });
}

/** Every course on the timetable, grouped for "Browse all courses". */
export async function listWorkspaceCourses(userId: string) {
  const schedule = await prisma.studentSchedule.findFirst({
    where: { ownerId: userId, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: { courses: { select: COURSE_SELECT } },
  });
  return (schedule?.courses ?? []) as WorkspaceCourse[];
}

/** "14:00" and "15:40" → "14:00 – 15:40"; falls back cleanly when unset. */
export function formatCourseTime(course: {
  startTime: string | null;
  endTime: string | null;
}) {
  if (course.startTime && course.endTime)
    return `${course.startTime} – ${course.endTime}`;
  return course.startTime ?? "Time not set";
}

/** Minutes until a course starts, or null when it has no clock time. */
export function minutesUntil(
  startTime: string | null,
  nowMinutes: number,
): number | null {
  if (!startTime) return null;
  const [hours, minutes] = startTime.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes - nowMinutes;
}
