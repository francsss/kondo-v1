import { AppShell } from "@/components/app/AppShell";
import { getUnreadMessageCount } from "@/lib/messaging";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [notificationUnreadCount, messageUnreadCount] = await Promise.all([
    getUnreadNotificationCount(user.id),
    getUnreadMessageCount(user.id),
  ]);

  return (
    <AppShell user={{ ...user, notificationUnreadCount, messageUnreadCount }}>
      {children}
    </AppShell>
  );
}
