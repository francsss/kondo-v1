"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";

type NotificationItemProps = {
  notification: {
    id: string;
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
  icon: ReactNode;
  timestamp: string;
  bordered: boolean;
};

export function NotificationItem({
  notification,
  icon,
  timestamp,
  bordered,
}: NotificationItemProps) {
  const router = useRouter();
  const [read, setRead] = useState(Boolean(notification.readAt));

  function markRead() {
    if (read) return;
    setRead(true);
    void fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
    });
  }

  async function hide() {
    const response = await fetch(`/api/notifications/${notification.id}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (response?.ok) router.refresh();
  }

  const content = (
    <div
      className={`relative flex gap-4 p-5 pr-12 transition hover:bg-slate-50 dark:hover:bg-white/5 ${
        read ? "" : "bg-emerald-50/50 dark:bg-emerald-400/5"
      }`}
    >
      <div className="relative">
        {notification.actor ? (
          <Avatar
            firstName={notification.actor.firstName}
            lastName={notification.actor.lastName}
            mediaId={notification.actor.avatarMediaId}
          />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
            {icon}
          </span>
        )}
        {!read ? (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-orange-500" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-kondo-ink dark:text-white">
              {notification.title}
            </p>
            {notification.body ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {notification.body}
              </p>
            ) : null}
          </div>
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {timestamp}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`group relative ${
        bordered ? "border-t border-slate-100 dark:border-white/10" : ""
      }`}
    >
      {notification.href ? (
        <Link href={notification.href} onClick={markRead}>
          {content}
        </Link>
      ) : (
        <button
          className="block w-full text-left"
          onClick={markRead}
          type="button"
        >
          {content}
        </button>
      )}
      <button
        aria-label="Hide notification"
        className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground opacity-0 transition hover:bg-slate-100 hover:text-muted-foreground group-hover:opacity-100 focus:opacity-100 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={hide}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
