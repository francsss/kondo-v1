import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listOrganizationOpportunities } from "@/lib/opportunity-management";
import { opportunityLifecycleLabel } from "@/lib/opportunity-lifecycle";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunities workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OrganizationOpportunitiesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const organization = await prisma.organization.findUnique({
    where: { slug: (await params).slug },
    select: { id: true, slug: true, publicName: true },
  });
  if (!organization) notFound();

  // Workspace access is enforced in the service, which throws for a
  // non-member or a removed member.
  const opportunities = await listOrganizationOpportunities({
    userId: user.id,
    organizationId: organization.id,
  });

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-8 sm:px-6 lg:pt-12">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
        {organization.publicName}
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
        Opportunities
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Scholarships, internships, jobs and programs published by this
        organization.
      </p>

      {opportunities.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          No opportunities yet.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">
              Opportunities published by {organization.publicName}
            </caption>
            <thead>
              <tr className="border-b border-black/10 dark:border-white/10">
                <th scope="col" className="py-2 pr-4 font-bold">
                  Title
                </th>
                <th scope="col" className="py-2 pr-4 font-bold">
                  Type
                </th>
                <th scope="col" className="py-2 pr-4 font-bold">
                  Status
                </th>
                <th scope="col" className="py-2 pr-4 font-bold">
                  Deadline
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
                  <td className="py-3 pr-4 font-semibold">
                    <Link
                      href={`/organizations/${organization.slug}/opportunities/${opportunity.id}/applications`}
                      className="hover:underline"
                    >
                      {opportunity.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">{opportunity.typeLabel}</td>
                  <td className="py-3 pr-4">
                    {opportunityLifecycleLabel(opportunity.lifecycle)}
                  </td>
                  <td className="py-3 pr-4">
                    {opportunity.deadline
                      ? new Date(opportunity.deadline).toLocaleDateString(
                          "en-GB",
                        )
                      : "—"}
                  </td>
                  {/* Counts only; no applicant detail in the list view. */}
                  <td className="py-3">{opportunity.applicationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
