import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { MarkAllReadButton } from "@/components/features/notifications/MarkAllReadButton";
import { NotificationAnalytics } from "@/components/features/notifications/NotificationAnalytics";
import { NotificationItem } from "@/components/features/notifications/NotificationItem";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  listNotifications,
  NOTIFICATION_CENTER_CATEGORIES,
  type NotificationCenterCategory,
} from "@/lib/notifications";
import { formatRelativeDate } from "@/lib/presentation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const rawCategory = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  const category = NOTIFICATION_CENTER_CATEGORIES.includes(
    rawCategory as NotificationCenterCategory,
  )
    ? (rawCategory as NotificationCenterCategory)
    : "all";
  const result = await listNotifications(user.id, {
    page: Number(rawPage ?? 1),
    pageSize: 20,
    category,
  });
  return (
    <div className="mx-auto max-w-[920px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/settings/notifications">
                <SlidersHorizontal className="h-4 w-4" />
                Preferences
              </Link>
            </Button>
            <MarkAllReadButton unreadCount={result.unreadCount} />
          </div>
        }
        description="Messages, communities, study reminders and important Kondo updates—all in one calm, recognizable place."
        eyebrow="Kondo updates"
        title="Notifications"
      />
      <NotificationAnalytics
        count={result.notifications.length}
        unreadCount={result.unreadCount}
      />
      <nav
        aria-label="Notification categories"
        className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {NOTIFICATION_CENTER_CATEGORIES.map((value) => (
          <Link
            aria-current={category === value ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${category === value ? "border-kondo-green bg-kondo-green text-white" : "border-border bg-card text-muted-foreground hover:border-kondo-green/40"}`}
            href={`/notifications?category=${value}`}
            key={value}
            scroll={false}
          >
            {value === "all"
              ? "All"
              : value
                  .split("-")
                  .map(
                    (part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`,
                  )
                  .join(" & ")}
          </Link>
        ))}
      </nav>
      <div className="mt-8">
        {result.notifications.length ? (
          <div className="space-y-3">
            {result.notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                timestamp={formatRelativeDate(new Date(notification.createdAt))}
              />
            ))}
          </div>
        ) : (
          <Card className="relative overflow-hidden px-6 py-16 text-center">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-kondo-green via-emerald-300 to-kondo-lime" />
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
              <Bell className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-black text-kondo-ink dark:text-white">
              You’re all caught up
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Useful updates will appear here.
            </p>
          </Card>
        )}
      </div>
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
                <Link
                  href={`/notifications?category=${category}&page=${result.page - 1}`}
                >
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
                <Link
                  href={`/notifications?category=${category}&page=${result.page + 1}`}
                >
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
