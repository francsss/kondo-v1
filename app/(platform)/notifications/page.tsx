import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { MarkAllReadButton } from "@/components/features/notifications/MarkAllReadButton";
import { NotificationAnalytics } from "@/components/features/notifications/NotificationAnalytics";
import { NotificationItem } from "@/components/features/notifications/NotificationItem";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listNotifications } from "@/lib/notifications";
import { formatRelativeDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Notifications" };

const icons = {
  MESSAGE: MessageCircle,
  COMMENT: MessageCircle,
  REPLY: MessageCircle,
  MARKETPLACE_UPDATE: ShoppingBag,
  COMMUNITY_ANNOUNCEMENT: Megaphone,
  MODERATION_UPDATE: ShieldCheck,
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const result = await listNotifications(user.id, {
    page: Number(rawPage ?? 1),
    pageSize: 20,
  });
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        action={<MarkAllReadButton unreadCount={result.unreadCount} />}
        description="Only the updates that help you respond, connect, or act."
        title="Notifications"
      />
      <NotificationAnalytics
        count={result.notifications.length}
        unreadCount={result.unreadCount}
      />
      <Card className="mt-8 overflow-hidden p-0">
        {result.notifications.length ? (
          result.notifications.map((notification, index) => {
            const Icon = icons[notification.type];
            return (
              <NotificationItem
                bordered={Boolean(index)}
                icon={<Icon className="h-4 w-4" />}
                key={notification.id}
                notification={notification}
                timestamp={formatRelativeDate(new Date(notification.createdAt))}
              />
            );
          })
        ) : (
          <div className="px-6 py-16 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 font-black text-kondo-ink dark:text-white">
              You’re all caught up
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Useful updates will appear here.
            </p>
          </div>
        )}
      </Card>
      {result.pageCount > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {result.page} of {result.pageCount} · {result.total} updates
          </p>
          <div className="flex gap-2">
            <Button
              asChild={result.page > 1}
              disabled={result.page <= 1}
              size="sm"
              variant="secondary"
            >
              {result.page > 1 ? (
                <Link href={`/notifications?page=${result.page - 1}`}>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Link>
              ) : (
                <span>
                  <ChevronLeft className="h-4 w-4" /> Previous
                </span>
              )}
            </Button>
            <Button
              asChild={result.page < result.pageCount}
              disabled={result.page >= result.pageCount}
              size="sm"
              variant="secondary"
            >
              {result.page < result.pageCount ? (
                <Link href={`/notifications?page=${result.page + 1}`}>
                  Next <ChevronRight className="h-4 w-4" />
                </Link>
              ) : (
                <span>
                  Next <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
