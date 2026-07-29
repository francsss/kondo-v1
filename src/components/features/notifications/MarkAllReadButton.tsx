"use client";

import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { broadcastNotificationCount } from "@/lib/notification-client";

export function MarkAllReadButton({ unreadCount }: { unreadCount: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markAllRead() {
    setLoading(true);
    const response = await fetch("/api/notifications/read-all", {
      method: "PATCH",
      credentials: "include",
    }).catch(() => null);
    setLoading(false);
    if (response?.ok) {
      broadcastNotificationCount(0);
      router.refresh();
    }
  }

  return (
    <Button
      disabled={!unreadCount || loading}
      onClick={markAllRead}
      size="sm"
      type="button"
      variant="secondary"
    >
      <CheckCheck className="h-4 w-4" />
      {loading ? "Updating…" : "Mark all read"}
    </Button>
  );
}
