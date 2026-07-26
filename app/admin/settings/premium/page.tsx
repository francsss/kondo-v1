import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { PremiumPlanManager } from "@/components/features/admin/PremiumPlanManager";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Premium settings" };

export default async function PremiumSettingsPage() {
  const user = await requireAdminPermission("PLATFORM_SETTINGS_VIEW");
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { displayOrder: "asc" },
  });
  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Manage public plan metadata and feature availability. Provider credentials and webhook secrets remain exclusively in Vercel."
        eyebrow="Platform settings"
        title="Premium plans"
      />
      <AdminNav currentPath="/admin/settings/premium" role={user.role} />
      <PremiumPlanManager
        canManage={hasAdminPermission(user.role, "PLATFORM_SETTINGS_MANAGE")}
        initialPlans={plans}
      />
    </div>
  );
}
