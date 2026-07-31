import type { Metadata } from "next";
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

export default async function AdminOpportunityApplicationsPage() {
  await requireAdminPermission("OPPORTUNITIES_VIEW");
  const items = await prisma.opportunityApplication.findMany({
    where: { status: { not: "DRAFT" } },
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
      _count: { select: { documents: true } },
    },
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
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
    </div>
  );
}
