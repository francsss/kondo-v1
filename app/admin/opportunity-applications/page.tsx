import type { Metadata } from "next";
import Link from "next/link";
import { applicationStatusLabel } from "@/lib/opportunity-application-status";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunity applications — Admin",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

function snapshotName(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return "Applicant";
  const name = (value as Record<string, unknown>).name;
  return typeof name === "string" ? name : "Applicant";
}

export default async function AdminOpportunityApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdminPermission("OPPORTUNITY_APPLICATIONS_VIEW");
  const requestedPage = Number((await searchParams).page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.max(1, Math.floor(requestedPage))
    : 1;
  const pageSize = 50;
  const where = { status: { not: "DRAFT" as const } };
  const [total, items] = await prisma.$transaction([
    prisma.opportunityApplication.count({ where }),
    prisma.opportunityApplication.findMany({
      where,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        applicantSnapshot: true,
        opportunity: {
          select: {
            title: true,
            publisherOrganization: { select: { publicName: true } },
          },
        },
      },
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-2xl font-black">Opportunity applications</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Metadata only. Candidate documents and internal review notes are not
        exposed in this global list.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4">Applicant</th>
              <th className="py-2 pr-4">Opportunity</th>
              <th className="py-2 pr-4">Publisher</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-3 pr-4 font-semibold">
                  {snapshotName(item.applicantSnapshot)}
                </td>
                <td className="py-3 pr-4">{item.opportunity.title}</td>
                <td className="py-3 pr-4">
                  {item.opportunity.publisherOrganization?.publicName ??
                    "Kondo"}
                </td>
                <td className="py-3 pr-4">
                  {applicationStatusLabel(item.status)}
                </td>
                <td className="py-3">
                  {item.submittedAt?.toLocaleDateString("en-GB") ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-6 flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Page {page} of {pageCount} · {total} submitted applications
        </p>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              className="rounded-full border border-border px-4 py-2 font-bold"
              href={`/admin/opportunity-applications?page=${page - 1}`}
            >
              Previous
            </Link>
          ) : null}
          {page < pageCount ? (
            <Link
              className="rounded-full border border-border px-4 py-2 font-bold"
              href={`/admin/opportunity-applications?page=${page + 1}`}
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
