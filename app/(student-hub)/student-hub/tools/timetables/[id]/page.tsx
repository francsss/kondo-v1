import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import {
  DAY_NAMES,
  findScheduleConflicts,
  formatCourseTime,
} from "@/lib/student-schedule";

export const metadata: Metadata = { title: "Generated timetable" };

export default async function TimetableResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string }>;
}) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const schedule = await prisma.studentSchedule.findFirst({
    where: { id, ownerId: user.id, isActive: true },
    include: {
      university: { select: { name: true } },
      campus: { select: { name: true } },
      academicTerm: { select: { name: true } },
      courses: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" },
          { startPeriod: "asc" },
        ],
      },
    },
  });
  if (!schedule) notFound();

  const conflicts = findScheduleConflicts(schedule.courses);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <Button asChild size="sm" variant="ghost">
        <Link href="/student-hub/tools">
          <ChevronLeft className="h-4 w-4" /> My Tools
        </Link>
      </Button>

      {query.generated === "1" ? (
        <div
          className="mt-5 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200"
          role="status"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Timetable generated successfully.
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
            Generated timetable
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
            {schedule.title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Saved securely to your account. This page reloads directly from the
            database.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
            <CalendarCheck2 className="h-4 w-4 text-kondo-green" />
            {schedule.courses.length} course
            {schedule.courses.length === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2">
            <Clock3 className="h-4 w-4 text-kondo-green" />
            {schedule.timezone}
          </span>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <div className="grid min-w-[760px] grid-cols-7 divide-x divide-border">
              {DAY_NAMES.map((day, index) => {
                const courses = schedule.courses.filter(
                  (course) => course.dayOfWeek === index + 1,
                );
                return (
                  <div className="min-h-[430px] p-2.5" key={day}>
                    <p className="mb-3 text-center text-xs font-black uppercase tracking-wide text-muted-foreground">
                      {day.slice(0, 3)}
                    </p>
                    <div className="space-y-2">
                      {courses.map((course) => (
                        <div
                          className="rounded-2xl border-l-4 bg-muted/70 p-3"
                          key={course.id}
                          style={{ borderLeftColor: course.color }}
                        >
                          <p className="line-clamp-2 text-xs font-black">
                            {course.courseName}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                            {formatCourseTime(course)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">
                            {course.room || course.teacher || "Class"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Schedule details
            </p>
            <h2 className="mt-3 font-black">
              {schedule.university?.name ?? "University not specified"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {schedule.academicTerm?.name ?? "Semester not specified"}
            </p>
            {schedule.campus?.name ? (
              <p className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <MapPin className="h-4 w-4" /> {schedule.campus.name}
              </p>
            ) : null}
          </Card>

          {conflicts.length ? (
            <Card className="border-amber-300 dark:border-amber-400/30">
              <p className="flex items-center gap-2 text-sm font-black text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Possible conflicts
              </p>
              <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                {conflicts.map((conflict) => (
                  <p key={`${conflict.firstId}-${conflict.secondId}`}>
                    {conflict.message}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
