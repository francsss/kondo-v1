import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, LibraryBig } from "lucide-react";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { requireUser } from "@/lib/server-auth";
import {
  formatCourseTime,
  getWorkspaceToday,
  minutesUntil,
  type WorkspaceCourse,
} from "@/lib/study-workspace-today";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Workspace — Study" };
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

export default async function StudyWorkspacePage() {
  const user = await requireUser();
  // Workspace reads a timetable, so it follows the same gate as the Planner.
  if (
    !studentHubAccessForJourney(user.studentJourney, Boolean(user.universityId))
      .academicTools
  ) {
    redirect("/student-hub");
  }

  const { today, current, next, clock, courseCount } = await getWorkspaceToday(
    user.id,
  );
  const dayLabel = clock ? (DAY_LABELS[clock.dayOfWeek] ?? "Today") : "Today";

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
          {dayLabel}
        </p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] sm:text-3xl">
          {today.length
            ? `${today.length} ${today.length === 1 ? "class" : "classes"} today`
            : "No classes today"}
        </h1>
      </header>

      {/*
       * One line of context above the list, and only when the clock actually
       * says something useful. A student mid-lecture wants a different sentence
       * from one with a class in ten minutes, and neither wants a dashboard.
       */}
      {current ? (
        <UpNext action="Open class" course={current} label="In class now" />
      ) : next && clock ? (
        <UpNext
          action="Prepare class"
          course={next}
          label={describeLead(minutesUntil(next.startTime, clock.minutes))}
        />
      ) : null}

      {today.length ? (
        <ol className="mt-5 space-y-2">
          {today.map((course) => (
            <li key={course.id}>
              <CourseRow
                course={course}
                highlighted={course.id === (current ?? next)?.id}
              />
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
          <CalendarDays
            aria-hidden="true"
            className="mx-auto h-6 w-6 text-muted-foreground"
          />
          <p className="mt-3 text-sm font-bold text-foreground">
            Nothing scheduled for {dayLabel.toLowerCase()}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {courseCount
              ? "Get ahead on another course instead."
              : "Add your timetable in the Planner and Workspace fills itself in."}
          </p>
          <Link
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-kondo-green px-5 text-sm font-black text-white"
            href={
              courseCount ? "/student-hub/workspace/all" : "/student-hub/tools"
            }
          >
            {courseCount ? "Browse courses" : "Open Planner"}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      )}

      {today.length && courseCount > today.length ? (
        // The secondary way out, deliberately quiet — not a second tab bar.
        <Link
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
          href="/student-hub/workspace/all"
        >
          <LibraryBig aria-hidden="true" className="h-4 w-4" />
          Browse all courses
        </Link>
      ) : null}
    </div>
  );
}

function describeLead(minutes: number | null) {
  if (minutes === null) return "Up next";
  if (minutes <= 0) return "Starting now";
  if (minutes < 60) return `Starts in ${minutes} min`;
  return "Up next";
}

function UpNext({
  course,
  label,
  action,
}: {
  course: WorkspaceCourse;
  label: string;
  action: string;
}) {
  return (
    <Link
      className="mt-4 flex items-center gap-3 rounded-2xl border border-kondo-green/40 bg-kondo-mint p-4 transition active:scale-[0.99] dark:bg-emerald-400/10 motion-reduce:active:scale-100"
      href={`/student-hub/workspace/${course.id}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-kondo-forest dark:text-emerald-300">
          {label}
        </span>
        <span className="mt-1 block truncate text-base font-black text-foreground">
          {course.courseName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {formatCourseTime(course)}
          {course.room ? ` · ${course.room}` : ""}
        </span>
      </span>
      <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-kondo-green px-4 text-xs font-black text-white">
        {action}
      </span>
    </Link>
  );
}

function CourseRow({
  course,
  highlighted,
}: {
  course: WorkspaceCourse;
  highlighted: boolean;
}) {
  // One course, one line of when and where, one line of what it needs.
  // Everything else waits behind the tap.
  return (
    <Link
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card p-3.5 transition active:scale-[0.99] motion-reduce:active:scale-100",
        highlighted
          ? "border-kondo-green/40"
          : "border-border hover:border-kondo-green/30",
      )}
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
        {/* One line of what this class needs: its book and its open work. */}
        {course.resourceTitle || course.tasks.length ? (
          <span className="mt-1 block truncate text-xs font-bold text-kondo-forest dark:text-emerald-300">
            {[
              course.resourceTitle,
              course.tasks.length
                ? `${course.tasks.length} ${course.tasks.length === 1 ? "task" : "tasks"}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
