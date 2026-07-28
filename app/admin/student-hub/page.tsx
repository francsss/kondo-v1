import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { StudentHubAdminManager } from "@/components/features/student-hub/StudentHubAdminManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin Student Hub" };

export default async function AdminStudentHubPage() {
  const user = await requireAdminPermission("STUDENT_HUB_CONFIG_VIEW");
  const universities = await prisma.university.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      shortName: true,
      campuses: { orderBy: { name: "asc" } },
      periodConfigurations: {
        include: {
          campus: { select: { name: true } },
          periods: { orderBy: { displayOrder: "asc" } },
        },
        orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      },
    },
    orderBy: { name: "asc" },
  });
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Configure university campuses and official numbered periods used by private timetable imports."
        eyebrow="Kondo operations"
        title="Student Hub"
      />
      <AdminNav currentPath="/admin/student-hub" role={user.role} />
      <StudentHubAdminManager
        canManage={user.role === "ADMIN" || user.role === "SUPER_ADMIN"}
        universities={universities.map((university) => ({
          ...university,
          campuses: university.campuses.map((campus) => ({
            ...campus,
            createdAt: campus.createdAt.toISOString(),
            updatedAt: campus.updatedAt.toISOString(),
          })),
          periodConfigurations: university.periodConfigurations.map(
            (configuration) => ({
              ...configuration,
              createdAt: configuration.createdAt.toISOString(),
              updatedAt: configuration.updatedAt.toISOString(),
              periods: configuration.periods.map((period) => ({
                ...period,
                createdAt: period.createdAt.toISOString(),
                updatedAt: period.updatedAt.toISOString(),
              })),
            }),
          ),
        }))}
      />
    </div>
  );
}
