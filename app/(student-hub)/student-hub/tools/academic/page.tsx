import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  ListTodo,
  type LucideIcon,
} from "lucide-react";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Academic tools — Student Hub",
  description:
    "Timetable import, saved schedules and exam tracking for your studies in China.",
};

export const dynamic = "force-dynamic";

/**
 * The tools index.
 *
 * The Planner is where a student works day to day; this is where they set that
 * workspace up and reach across it — importing a timetable, switching between
 * saved schedules, checking what is graded. Every card links into the existing
 * planner flows, so nothing here re-implements schedules, tasks or imports.
 */
export default async function AcademicToolsPage() {
  const user = await requireUser();
  if (
    !studentHubAccessForJourney(user.studentJourney, Boolean(user.universityId))
      .academicTools
  ) {
    redirect("/student-hub");
  }

  const [schedules, importCount, examCount, openTaskCount] = await Promise.all([
    prisma.studentSchedule.findMany({
      where: { ownerId: user.id, isActive: true },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        confirmedAt: true,
        university: { select: { name: true } },
        _count: { select: { courses: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.scheduleImport.count({ where: { ownerId: user.id } }),
    prisma.academicTask.count({
      where: { ownerId: user.id, kind: "EXAM", status: { not: "CANCELLED" } },
    }),
    prisma.academicTask.count({
      where: {
        ownerId: user.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <h1 className="text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
          Academic tools
        </h1>
        <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
          Set up and maintain the workspace your Planner runs on — import a
          timetable, switch between saved schedules, and keep an eye on what is
          graded.
        </p>
      </header>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          description="Upload a photo or PDF of your university timetable and let Kondo turn it into a schedule you can edit."
          href="/student-hub/tools?view=schedule"
          icon={FileUp}
          label="Import a timetable"
          meta={
            importCount
              ? `${importCount} import${importCount > 1 ? "s" : ""} so far`
              : "No import yet"
          }
        />
        <ToolCard
          description="Your week, period by period, with the courses Kondo extracted or you entered by hand."
          href="/student-hub/tools?view=schedule"
          icon={CalendarDays}
          label="Schedule"
          meta={`${schedules.length} saved schedule${schedules.length === 1 ? "" : "s"}`}
        />
        <ToolCard
          description="Assignments, projects and reminders, with what is due next at the top."
          href="/student-hub/tools?view=tasks"
          icon={ListTodo}
          label="Tasks"
          meta={
            openTaskCount ? `${openTaskCount} open` : "Nothing open right now"
          }
        />
        <ToolCard
          description="Everything marked as an exam, so revision never depends on remembering a date."
          href="/student-hub/tools?view=tasks"
          icon={ClipboardCheck}
          label="Exams"
          meta={examCount ? `${examCount} tracked` : "None tracked yet"}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-black tracking-tight">Saved schedules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Open any of them in the Planner.
        </p>

        {schedules.length ? (
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <Link
                  className="group flex items-center gap-4 rounded-[1.5rem] border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
                  href={`/student-hub/tools?view=schedule&schedule=${schedule.id}`}
                >
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                  >
                    <GraduationCap className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black group-hover:text-kondo-green">
                      {schedule.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[
                        schedule.university?.name,
                        `${schedule._count.courses} course${schedule._count.courses === 1 ? "" : "s"}`,
                        schedule.confirmedAt ? "Confirmed" : "Draft",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-kondo-green"
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-5 rounded-[1.75rem] border border-dashed border-border p-8 text-center">
            <p className="font-black">No schedule yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Import your university timetable and the Planner fills itself —
              today&rsquo;s classes, the week ahead, and the deadlines attached
              to each course.
            </p>
            <Link
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
              href="/student-hub/tools?view=schedule"
            >
              <FileUp aria-hidden="true" className="h-4 w-4" />
              Import a timetable
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function ToolCard({
  label,
  description,
  href,
  icon: Icon,
  meta,
}: {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  meta: string;
}) {
  return (
    <Link
      className="group flex h-full flex-col rounded-[1.75rem] border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
      href={href}
    >
      <span
        aria-hidden="true"
        className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-4 block font-black group-hover:text-kondo-green">
        {label}
      </span>
      <span className="mt-1.5 block flex-1 text-sm leading-6 text-muted-foreground">
        {description}
      </span>
      <span className="mt-4 block text-xs font-bold tabular-nums text-kondo-green">
        {meta}
      </span>
    </Link>
  );
}
