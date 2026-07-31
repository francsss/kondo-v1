import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunity reports — Admin",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminOpportunityReportsPage() {
  await requireAdminPermission("OPPORTUNITIES_VIEW");
  const reports = await prisma.report.findMany({
    where: { targetType: "Opportunity" },
    select: {
      id: true,
      targetId: true,
      reason: true,
      details: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const titles = new Map(
    (
      await prisma.opportunity.findMany({
        where: { id: { in: reports.map((report) => report.targetId) } },
        select: { id: true, title: true },
      })
    ).map((item) => [item.id, item.title]),
  );
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8">
      <h1 className="text-2xl font-black">Opportunity reports</h1>
      <ul className="mt-6 space-y-3">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-3xl border border-black/5 p-5 dark:border-white/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/admin/opportunities/${report.targetId}`}
                className="font-black hover:underline"
              >
                {titles.get(report.targetId) ?? "Unavailable opportunity"}
              </Link>
              <span className="text-xs font-bold uppercase text-muted-foreground">
                {report.status}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold">{report.reason}</p>
            {report.details ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {report.details}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-muted-foreground">
              {report.createdAt.toLocaleString("en-GB")}
            </p>
          </li>
        ))}
        {reports.length === 0 ? (
          <li className="text-sm text-muted-foreground">
            No opportunity reports.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
