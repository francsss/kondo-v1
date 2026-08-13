import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/server-auth";
import {
  formatCourseTime,
  listWorkspaceCourses,
} from "@/lib/study-workspace-today";

export const metadata: Metadata = { title: "All courses — Workspace" };
export const dynamic = "force-dynamic";

const DAY_LABELS = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * The way out of today, without a second tab bar.
 *
 * Workspace defaults to today because that is the question it answers, but a
 * student preparing tomorrow should not have to wait for tomorrow.
 */
export default async function WorkspaceAllCoursesPage() {
  const user = await requireUser();
  const courses = await listWorkspaceCourses(user.id);
  const byDay = new Map<number, typeof courses>();
  for (const course of courses) {
    byDay.set(course.dayOfWeek, [
      ...(byDay.get(course.dayOfWeek) ?? []),
      course,
    ]);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/workspace"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Workspace
      </Link>
      <h1 className="mt-4 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
        All courses
      </h1>

      {days.length ? (
        days.map((day) => (
          <section className="mt-6" key={day}>
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {DAY_LABELS[day] ?? `Day ${day}`}
            </h2>
            <ul className="mt-2 space-y-2">
              {(byDay.get(day) ?? []).map((course) => (
                <li key={course.id}>
                  <Link
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 transition hover:border-kondo-green/30 active:scale-[0.99] motion-reduce:active:scale-100"
                    href={`/student-hub/workspace/${course.id}`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-10 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: course.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-foreground">
                        {course.courseName}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {formatCourseTime(course)}
                        {course.room ? ` · ${course.room}` : ""}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No courses on your timetable yet.{" "}
          <Link
            className="font-bold text-kondo-green"
            href="/student-hub/tools"
          >
            Open the Planner
          </Link>{" "}
          to add them.
        </p>
      )}
    </div>
  );
}
