import { AppShell } from "@/components/app/AppShell";
import { getUnreadMessageCount } from "@/lib/messaging";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { listOrganizationWorkspaces } from "@/lib/organization-workspaces";
import { requireAdmin } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const [notificationUnreadCount, messageUnreadCount, workspaces] =
    await Promise.all([
      getUnreadNotificationCount(user.id),
      getUnreadMessageCount(user.id),
      listOrganizationWorkspaces(user.id),
    ]);
  return (
    <AppShell
      user={{ ...user, notificationUnreadCount, messageUnreadCount }}
      workspaces={workspaces}
    >
      {children}
    </AppShell>
  );
}
