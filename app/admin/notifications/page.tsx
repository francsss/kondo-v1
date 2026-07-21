import type { Metadata } from "next";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { NotificationAdminPanel } from "@/components/features/admin/NotificationAdminPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import {
  getNotificationDiagnostics,
  listNotificationAudienceOptions,
} from "@/lib/notifications";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin notifications" };

export default async function AdminNotificationsPage() {
  const user = await requireAdminPermission("NOTIFICATION_VIEW");
  const [diagnostics, audienceOptions] = await Promise.all([
    getNotificationDiagnostics(user),
    listNotificationAudienceOptions(user),
  ]);
  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Manage bounded notification templates, queue useful product announcements, and inspect asynchronous delivery health."
        eyebrow="Kondo operations"
        title="Notifications"
      />
      <AdminNav currentPath="/admin/notifications" role={user.role} />
      <NotificationAdminPanel
        canManage={hasAdminPermission(user.role, "NOTIFICATION_MANAGE")}
        diagnostics={diagnostics}
        audienceOptions={audienceOptions}
      />
    </div>
  );
}
