"use client";

import { useEffect } from "react";

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
    });
  }, [conversationId, latestMessageId]);

  return null;
}
