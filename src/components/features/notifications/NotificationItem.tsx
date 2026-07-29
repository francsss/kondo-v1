"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, X } from "lucide-react";
import { useState } from "react";
import { NotificationIcon } from "@/components/features/notifications/NotificationIcon";
import { Avatar } from "@/components/ui/Avatar";
import { notificationPresentation } from "@/features/notifications/presentation";
import { adjustNotificationCount } from "@/lib/notification-client";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { cn } from "@/lib/utils";

type NotificationItemProps = {
  notification: {
    id: string;
    type: string;
    templateKey: string | null;
    title: string;
    body: string | null;
    href: string | null;
    readAt: string | null;
    createdAt: string;
    actor: {
      id: string;
      firstName: string;
      lastName: string;
      avatarMediaId: string | null;
    } | null;
  };
  timestamp: string;
};

export function NotificationItem({
  notification,
  timestamp,
}: NotificationItemProps) {
  const router = useRouter();
  const [read, setRead] = useState(Boolean(notification.readAt));
  const [hiding, setHiding] = useState(false);
  const presentation = notificationPresentation(notification);

  function markRead() {
    captureProductEvent(PRODUCT_EVENTS.NOTIFICATION_OPENED, {
      notification_type: notification.type,
      has_action: Boolean(notification.href),
    });
    if (notification.href) {
      captureProductEvent(PRODUCT_EVENTS.NOTIFICATION_ACTIONED, {
        notification_type: notification.type,
      });
    }
    if (read) return;
    setRead(true);
    adjustNotificationCount(-1);
    void fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
    });
  }

  async function hide() {
    if (hiding) return;
    setHiding(true);
    const response = await fetch(`/api/notifications/${notification.id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) {
      if (!read) adjustNotificationCount(-1);
      captureProductEvent(PRODUCT_EVENTS.NOTIFICATION_ACTIONED, {
        notification_type: notification.type,
        action: "dismissed",
      });
      router.refresh();
      return;
    }
    setHiding(false);
  }

  const content = (
    <div className="flex min-w-0 flex-1 items-start gap-4">
      <div className="relative shrink-0">
        {notification.actor ? (
          <>
            <Avatar
              className="h-12 w-12 ring-2 ring-background"
              firstName={notification.actor.firstName}
              lastName={notification.actor.lastName}
              mediaId={notification.actor.avatarMediaId}
              seed={notification.actor.id}
            />
            <NotificationIcon
              category={presentation.category}
              className="absolute -bottom-1.5 -right-1.5 h-7 w-7 rounded-xl border-2 border-card [&>svg]:h-3.5 [&>svg]:w-3.5"
              icon={presentation.icon}
            />
          </>
        ) : (
          <div className="relative">
            <NotificationIcon
              category={presentation.category}
              className="h-12 w-12"
              icon={presentation.icon}
            />
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-lg border-2 border-card bg-kondo-green text-[9px] font-black text-white">
              K
            </span>
          </div>
        )}
        {!read ? (
          <span
            aria-label="Unread"
            className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-[3px] border-card bg-orange-500"
            role="status"
          />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {presentation.categoryLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">{timestamp}</span>
        </div>
        <h2
          className={cn(
            "mt-2 text-sm leading-5 text-foreground",
            read ? "font-bold" : "font-black",
          )}
        >
          {notification.title}
        </h2>
        {notification.body ? (
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {notification.body}
          </p>
        ) : null}
        {notification.href ? (
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
            {presentation.actionLabel}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        ) : !read ? (
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-kondo-green">
            <Check className="h-3.5 w-3.5" />
            Mark as read
          </span>
        ) : null}
      </div>
    </div>
  );

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-[1.6rem] border p-5 pr-14 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none",
        read
          ? "border-border bg-card"
          : "border-kondo-green/25 bg-gradient-to-br from-card via-card to-emerald-50/75 shadow-[0_10px_35px_rgba(15,138,100,0.08)] dark:to-emerald-400/5",
        hiding && "pointer-events-none opacity-50",
      )}
    >
      {!read ? (
        <div className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b from-kondo-green to-emerald-300" />
      ) : null}
      {notification.href ? (
        <Link
          className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-green"
          href={notification.href}
          onClick={markRead}
        >
          {content}
        </Link>
      ) : (
        <button
          className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-green"
          onClick={markRead}
          type="button"
        >
          {content}
        </button>
      )}
      <button
        aria-label="Hide notification"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-muted-foreground opacity-70 transition hover:bg-muted hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kondo-green sm:opacity-0 sm:group-hover:opacity-100"
        disabled={hiding}
        onClick={() => void hide()}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </article>
  );
}
