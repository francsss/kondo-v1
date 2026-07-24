import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { ScholarshipAdminManager } from "@/components/features/student-hub/ScholarshipAdminManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin Scholarships" };

export default async function AdminScholarshipsPage() {
  const user = await requireAdminPermission("STUDENT_HUB_CONFIG_VIEW");
  const [scholarships, agents, countries, universities] = await Promise.all([
    prisma.scholarship.findMany({
      include: {
        country: { select: { id: true, name: true } },
        universities: { select: { universityId: true } },
      },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
    prisma.scholarshipAgent.findMany({
      include: { country: { select: { id: true, name: true } } },
      orderBy: [{ isActive: "desc" }, { verified: "desc" }, { name: "asc" }],
    }),
    prisma.country.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true, countryId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Publish verified opportunities and manage the trusted advisers available to Kondo students."
        eyebrow="Student Hub CMS"
        title="Scholarships ecosystem"
      />
      <AdminNav currentPath="/admin/scholarships" role={user.role} />
      <ScholarshipAdminManager
        agents={agents.map((agent) => ({
          ...agent,
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
          verifiedAt: agent.verifiedAt?.toISOString() ?? null,
        }))}
        canManage={user.role === "ADMIN" || user.role === "SUPER_ADMIN"}
        countries={countries}
        scholarships={scholarships.map((scholarship) => ({
          ...scholarship,
          opensAt: scholarship.opensAt?.toISOString().slice(0, 10) ?? null,
          closesAt: scholarship.closesAt?.toISOString().slice(0, 10) ?? null,
          deadline: scholarship.deadline?.toISOString().slice(0, 10) ?? null,
          lastVerifiedAt: scholarship.lastVerifiedAt?.toISOString() ?? null,
          createdAt: scholarship.createdAt.toISOString(),
          updatedAt: scholarship.updatedAt.toISOString(),
          universityIds: scholarship.universities.map(
            ({ universityId }) => universityId,
          ),
        }))}
        universities={universities}
      />
    </div>
  );
}
