import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListTodo } from "lucide-react";
import { CourseMaterials } from "@/components/features/student-hub/CourseMaterials";
import { FocusToggle } from "@/components/features/student-hub/FocusToggle";
import { WorkspaceCapture } from "@/components/features/student-hub/WorkspaceCapture";
import { requireUser } from "@/lib/server-auth";
import {
  formatCourseTime,
  getWorkspaceCourse,
} from "@/lib/study-workspace-today";
import {
  listCourseRecentNotes,
  listCourseResources,
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
  const [course, materials, recent] = await Promise.all([
    getWorkspaceCourse(user.id, courseId),
    listCourseResources(user.id, courseId),
    listCourseRecentNotes(user.id, courseId),
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

      {recent.length ? (
        <section className="mt-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Recent
          </h2>
          <ul className="mt-3 space-y-2">
            {recent.map((note) => (
              <li
                className="rounded-2xl border border-border bg-card p-3.5"
                key={note.id}
              >
                <p className="truncate text-sm font-bold text-foreground">
                  {note.body?.trim() || note.highlight || "Highlight"}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {note.essential.title}
                  {note.chapter ? ` · ${note.chapter.title}` : ""}
                  {note.taskId ? " · task raised" : ""}
                </p>
              </li>
            ))}
          </ul>
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
