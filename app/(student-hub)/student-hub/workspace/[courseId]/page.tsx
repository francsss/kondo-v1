import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  FileText,
  Highlighter,
  ListTodo,
  Mic,
  PenLine,
} from "lucide-react";
import { CourseMaterials } from "@/components/features/student-hub/CourseMaterials";
import { FocusToggle } from "@/components/features/student-hub/FocusToggle";
import { WorkspaceCapture } from "@/components/features/student-hub/WorkspaceCapture";
import { requireUser } from "@/lib/server-auth";
import {
  formatCourseTime,
  getWorkspaceCourse,
} from "@/lib/study-workspace-today";
import {
  listCourseActivity,
  listCourseResources,
  type CourseActivityEntry,
} from "@/lib/study-workspace";

export const metadata: Metadata = { title: "Course — Workspace" };
export const dynamic = "force-dynamic";

export default async function WorkspaceCoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const user = await requireUser();
  const courseId = (await params).courseId;
  // Course and its materials in parallel: neither waits on the other.
  const [course, materials, activity] = await Promise.all([
    getWorkspaceCourse(user.id, courseId),
    listCourseResources(user.id, courseId),
    listCourseActivity(user.id, courseId),
  ]);
  if (!course) notFound();

  // The one action worth leading with: resume the book being read for this
  // course, if there is one. Otherwise the capture control carries the screen.
  const resume =
    materials.find((material) => material.progress?.chapter) ??
    materials.find(
      (material) => material.format === "DIGITAL" && material.chapterCount,
    );

  const place = [course.room, course.building].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-[720px] px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/workspace"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Workspace
      </Link>

      <header className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
            {course.courseName}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {formatCourseTime(course)}
            {place ? ` · ${place}` : ""}
            {course.teacher ? ` · ${course.teacher}` : ""}
          </p>
        </div>
        <FocusToggle label={course.courseName} />
      </header>

      {/*
       * One primary action. Everything a student can add sits behind the
       * compact control below it rather than as five competing buttons.
       */}
      <WorkspaceCapture
        courseId={course.id}
        courseName={course.courseName}
        resume={
          resume
            ? {
                slug: resume.slug,
                title: resume.title,
                chapterLabel: resume.progress?.chapter
                  ? `Chapter ${resume.progress.chapter.position + 1} · ${resume.progress.chapter.title}`
                  : null,
              }
            : null
        }
      />

      <CourseMaterials courseId={course.id} materials={materials} />

      <section className="mt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Open work
        </h2>
        {course.tasks.length ? (
          <ul className="mt-3 space-y-2">
            {course.tasks.map((task) => (
              <li
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                key={task.id}
              >
                <ListTodo
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-kondo-green"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-foreground">
                    {task.title}
                  </span>
                  {task.dueAt ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Due{" "}
                      {task.dueAt.toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing open for this course.
          </p>
        )}
        <Link
          className="mt-3 inline-flex text-sm font-bold text-muted-foreground transition hover:text-kondo-green"
          href="/student-hub/tools"
        >
          Open in Planner →
        </Link>
      </section>

      {activity.length ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Recent
          </h2>
          {/*
           * Grouped by day rather than listed flat. A run of captures taken in
           * one lecture belongs together, and the heading is what makes them
           * read as that session instead of six unrelated rows.
           */}
          {activity.map((day) => (
            <div className="mt-4" key={day.key}>
              <h3 className="text-xs font-black text-foreground">
                {describeDay(day.date)}
              </h3>
              <ul className="mt-2 space-y-2">
                {day.entries.map((entry) => (
                  <li key={entry.id}>
                    <ActivityRow entry={entry} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {course.notes ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Notes on this course
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {course.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

/** "Today", "Yesterday", then a plain date once it stops being either. */
function describeDay(date: Date) {
  const startOf = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(days > 300 ? { year: "numeric" } : {}),
  });
}

const ACTIVITY_ICON = {
  NOTE: PenLine,
  HIGHLIGHT: Highlighter,
  PHOTO: Camera,
  DOCUMENT: FileText,
  VOICE: Mic,
};

function ActivityRow({ entry }: { entry: CourseActivityEntry }) {
  const Icon = ACTIVITY_ICON[entry.kind];
  const time = entry.createdAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-start gap-3">
        <Icon
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">
            {entry.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[entry.source, time, entry.hasTask ? "task raised" : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      {/*
       * The file itself, where showing it beats naming it. Media is served by
       * `/api/media/[id]`, which authorizes the viewer on every request — the
       * id in the markup is not the permission.
       */}
      {entry.mediaId && entry.kind === "PHOTO" ? (
        // Private, owner-authorized bytes behind an API route, so the image
        // optimizer cannot fetch them.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={entry.title}
          className="mt-3 max-h-64 w-full rounded-xl object-cover"
          loading="lazy"
          src={`/api/media/${entry.mediaId}`}
        />
      ) : null}
      {entry.mediaId && entry.kind === "VOICE" ? (
        <audio
          className="mt-3 w-full"
          controls
          preload="none"
          src={`/api/media/${entry.mediaId}`}
        >
          <track kind="captions" />
        </audio>
      ) : null}
      {entry.mediaId && entry.kind === "DOCUMENT" ? (
        <a
          className="mt-3 inline-flex min-h-9 items-center rounded-full border border-border px-3.5 text-xs font-black text-foreground transition hover:border-kondo-green/40"
          href={`/api/media/${entry.mediaId}`}
          rel="noreferrer"
          target="_blank"
        >
          Open document
        </a>
      ) : null}
    </div>
  );
}
