import type { Metadata } from "next";
import { opportunityLifecycleLabel } from "@/lib/opportunity-lifecycle";
import { opportunityTypeDefinition } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunities — Admin",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminOpportunitiesPage() {
  await requireAdminPermission("OPPORTUNITIES_VIEW");
  const opportunities = await prisma.opportunity.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      lifecycle: true,
      publisherType: true,
      publicationBlockedAt: true,
      createdAt: true,
      publisherOrganization: { select: { publicName: true } },
      // Counts only: private application content never appears in a list view.
      _count: { select: { applications: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-2xl font-black tracking-[-0.03em]">Opportunities</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {opportunities.length} most recent records.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <caption className="sr-only">All opportunities</caption>
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th scope="col" className="py-2 pr-4 font-bold">
                Title
              </th>
              <th scope="col" className="py-2 pr-4 font-bold">
                Type
              </th>
              <th scope="col" className="py-2 pr-4 font-bold">
                Publisher
              </th>
              <th scope="col" className="py-2 pr-4 font-bold">
                Status
              </th>
              <th scope="col" className="py-2 font-bold">
                Applications
              </th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((opportunity) => (
              <tr
                key={opportunity.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-3 pr-4 font-semibold">{opportunity.title}</td>
                <td className="py-3 pr-4">
                  {opportunityTypeDefinition(opportunity.type).label}
                </td>
                <td className="py-3 pr-4">
                  {opportunity.publisherOrganization?.publicName ??
                    (opportunity.publisherType === "EDITORIAL"
                      ? "Kondo editorial"
                      : "Legacy agent")}
                </td>
                <td className="py-3 pr-4">
                  {opportunityLifecycleLabel(opportunity.lifecycle)}
                  {opportunity.publicationBlockedAt ? " · blocked" : ""}
                </td>
                <td className="py-3">{opportunity._count.applications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
