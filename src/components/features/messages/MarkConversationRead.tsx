"use client";

import { useEffect } from "react";
import { broadcastMessageCount } from "@/lib/notification-client";

export function MarkConversationRead({
  conversationId,
  latestMessageId,
}: {
  conversationId: string;
  latestMessageId: string;
}) {
  useEffect(() => {
    void fetch(`/api/conversations/${conversationId}/read`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latestMessageId }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ unreadCount?: unknown }>;
      })
      .then((payload) => {
        if (typeof payload?.unreadCount === "number") {
          broadcastMessageCount(payload.unreadCount);
        }
      })
      .catch(() => null);
  }, [conversationId, latestMessageId]);

  return null;
}
