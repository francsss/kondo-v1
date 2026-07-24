"use client";

import { useEffect } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function NotificationAnalytics({
  count,
  unreadCount,
}: {
  count: number;
  unreadCount: number;
}) {
  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.NOTIFICATIONS_RECEIVED, {
      visible_count: count,
      unread_count: unreadCount,
    });
  }, [count, unreadCount]);
  return null;
}
