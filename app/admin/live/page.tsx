import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { LivePresenceDashboard } from "@/components/features/admin/LivePresenceDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { presenceStore } from "@/lib/presence";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Live users" };
export const dynamic = "force-dynamic";

export default async function AdminLiveUsersPage() {
  const user = await requireAdminPermission("ANALYTICS_VIEW");
  const generatedAt = new Date();
  const onlineUsers = await presenceStore.listOnline(generatedAt);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="A lightweight five-minute heartbeat shows who is currently using Kondo. Members become offline automatically after seven minutes without activity."
        eyebrow="Kondo operations"
        title="Live users"
      />
      <AdminNav currentPath="/admin/live" role={user.role} />
      <LivePresenceDashboard
        initialGeneratedAt={generatedAt.toISOString()}
        initialUsers={onlineUsers}
      />
    </div>
  );
}
