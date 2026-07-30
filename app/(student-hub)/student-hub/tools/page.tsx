import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScheduleWorkspace } from "@/components/features/student-hub/ScheduleWorkspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { studentHubAccessForJourney } from "@/lib/personal-journeys";

export const metadata: Metadata = { title: "My Student Tools" };

export default async function StudentToolsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    schedule?: string;
    generated?: string;
  }>;
}) {
  const user = await requireUser();
  if (!studentHubAccessForJourney(user.studentJourney).academicTools) {
    redirect("/student-hub");
  }
  const query = await searchParams;
  const [universities, schedules, recentImports, tasks] = await Promise.all([
    prisma.university.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        shortName: true,
        campuses: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
        periodConfigurations: {
          where: { isActive: true },
          select: { id: true, campusId: true, isDefault: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.studentSchedule.findMany({
      where: { ownerId: user.id, isActive: true },
      include: {
        university: { select: { name: true } },
        campus: { select: { name: true } },
        academicTerm: {
          select: { name: true, firstWeekStartsOn: true, totalWeeks: true },
        },
        courses: {
          orderBy: [
            { dayOfWeek: "asc" },
            { startTime: "asc" },
            { startPeriod: "asc" },
          ],
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.scheduleImport.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        status: true,
        processingStage: true,
        createdAt: true,
        errorMessage: true,
        result: { select: { extractedJson: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.academicTask.findMany({
      where: { ownerId: user.id, status: { not: "CANCELLED" } },
      include: {
        course: { select: { id: true, courseName: true, color: true } },
      },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  const recoverableImport = recentImports.find(
    (item) => item.status === "REVIEW_REQUIRED" && item.result,
  );
  return (
    <ScheduleWorkspace
      initialScheduleId={query.schedule}
      initialSection={
        query.view === "schedule" || query.view === "tasks"
          ? query.view
          : "today"
      }
      initialSuccess={
        query.generated === "1"
          ? "Timetable generated successfully."
          : undefined
      }
      userName={user.firstName}
      initialReview={
        recoverableImport
          ? {
              importId: recoverableImport.id,
              result: recoverableImport.result!.extractedJson,
            }
          : null
      }
      recentImports={recentImports.map((item) => ({
        id: item.id,
        status: item.status,
        processingStage: item.processingStage,
        errorMessage: item.errorMessage,
        createdAt: item.createdAt.toISOString(),
      }))}
      tasks={tasks.map((task) => ({
        ...task,
        dueAt: task.dueAt?.toISOString() ?? null,
        reminderAt: task.reminderAt?.toISOString() ?? null,
        completedAt: task.completedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      }))}
      schedules={schedules.map((schedule) => ({
        ...schedule,
        createdAt: schedule.createdAt.toISOString(),
        updatedAt: schedule.updatedAt.toISOString(),
        confirmedAt: schedule.confirmedAt?.toISOString() ?? null,
        academicTerm: schedule.academicTerm
          ? {
              ...schedule.academicTerm,
              firstWeekStartsOn:
                schedule.academicTerm.firstWeekStartsOn.toISOString(),
            }
          : null,
        courses: schedule.courses.map((course) => ({
          ...course,
          specificDate: course.specificDate?.toISOString() ?? null,
          createdAt: course.createdAt.toISOString(),
          updatedAt: course.updatedAt.toISOString(),
        })),
      }))}
      universities={universities}
    />
  );
}
