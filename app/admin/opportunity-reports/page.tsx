import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunity reports — Admin",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

export default async function AdminOpportunityReportsPage() {
  await requireAdminPermission("OPPORTUNITY_REPORTS_REVIEW");
  // Compatibility route: use the shared moderation queue so report text,
  // reporter identity and evidence keep the same scoped authorization rules.
  redirect("/admin/reports?targetType=Opportunity");
}
