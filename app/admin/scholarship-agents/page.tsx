import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Scholarship agents — Admin",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminScholarshipAgentsPage() {
  await requireAdminPermission("OPPORTUNITIES_VIEW");
  const agents = await prisma.scholarshipAgent.findMany({
    select: {
      id: true,
      name: true,
      company: true,
      verified: true,
      isActive: true,
      availability: true,
      email: true,
      country: { select: { name: true } },
      _count: { select: { opportunities: true } },
    },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
  });
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8">
      <h1 className="text-2xl font-black">Scholarship agents</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Legacy agent records remain read-only in the unified Opportunities
        domain.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4">Agent</th>
              <th className="py-2 pr-4">Country</th>
              <th className="py-2 pr-4">Trust</th>
              <th className="py-2 pr-4">Availability</th>
              <th className="py-2">Opportunities</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-b border-black/5 dark:border-white/5"
              >
                <td className="py-3 pr-4">
                  <p className="font-bold">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {agent.company ?? agent.email ?? "Independent"}
                  </p>
                </td>
                <td className="py-3 pr-4">{agent.country?.name ?? "—"}</td>
                <td className="py-3 pr-4">
                  {agent.verified ? "Verified by Kondo" : "Not verified"}
                  {!agent.isActive ? " · inactive" : ""}
                </td>
                <td className="py-3 pr-4">
                  {agent.availability.toLowerCase().replace(/_/g, " ")}
                </td>
                <td className="py-3">{agent._count.opportunities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
