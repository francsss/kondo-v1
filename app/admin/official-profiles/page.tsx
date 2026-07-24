import type { OfficialProfileStatus } from "@prisma/client";
import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { OfficialProfileAdminManager } from "@/components/features/admin/OfficialProfileAdminManager";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listVerificationRequests } from "@/lib/official-profiles";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";
import { officialProfileStatuses } from "@/lib/story-validation";

export const metadata: Metadata = { title: "Admin official profiles" };

export default async function AdminOfficialProfilesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("OFFICIAL_PROFILE_VIEW");
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;
  const status = officialProfileStatuses.includes(
    rawStatus as (typeof officialProfileStatuses)[number],
  )
    ? (rawStatus as OfficialProfileStatus)
    : undefined;
  const query = Array.isArray(params.q) ? params.q[0] : params.q;
  const [result, awaiting, approved, reviewDue] = await Promise.all([
    listVerificationRequests(user, {
      status,
      query,
      page: Number(params.page ?? 1),
    }),
    prisma.officialVerificationRequest.count({
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
    }),
    prisma.user.count({ where: { officialProfileStatus: "APPROVED" } }),
    prisma.user.count({ where: { officialProfileStatus: "REVIEW_REQUIRED" } }),
  ]);
  return (
    <main className="mx-auto max-w-[1380px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Confidentially verify organizational authority, document every decision and keep the public trust signal current."
        eyebrow="Kondo trust operations"
        title="Official profiles"
      />
      <AdminNav currentPath="/admin/official-profiles" role={user.role} />
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-3xl font-black">{awaiting}</p>
          <p className="mt-1 text-xs text-muted-foreground">Awaiting review</p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{approved}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Active Official Profiles
          </p>
        </Card>
        <Card>
          <p className="text-3xl font-black">{reviewDue}</p>
          <p className="mt-1 text-xs text-muted-foreground">Review required</p>
        </Card>
      </section>
      <OfficialProfileAdminManager requests={result.records} />
    </main>
  );
}
