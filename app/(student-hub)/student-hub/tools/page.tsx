import type { Metadata } from "next";
import { ScheduleWorkspace } from "@/components/features/student-hub/ScheduleWorkspace";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "My Student Tools" };

export default async function StudentToolsPage() {
  const user = await requireUser();
  const [universities, schedules, recentImports] = await Promise.all([
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
        academicTerms: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            campusId: true,
            startsOn: true,
            endsOn: true,
            firstWeekStartsOn: true,
            totalWeeks: true,
          },
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
        courses: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.scheduleImport.findMany({
      where: { ownerId: user.id },
      select: { id: true, status: true, createdAt: true, errorMessage: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);
  return (
    <ScheduleWorkspace
      recentImports={recentImports.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
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
      universities={universities.map((university) => ({
        ...university,
        academicTerms: university.academicTerms.map((term) => ({
          ...term,
          startsOn: term.startsOn.toISOString(),
          endsOn: term.endsOn.toISOString(),
          firstWeekStartsOn: term.firstWeekStartsOn.toISOString(),
        })),
      }))}
    />
  );
}
