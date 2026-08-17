"use client";

import { useEffect } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

/**
 * One event when the books page is seen.
 *
 * A tiny client island rather than a client page: the store itself stays a
 * server component, so none of its queries or catalogue data crosses into the
 * browser bundle just to record a view.
 */
export function BooksPageAnalytics({ ownedCount }: { ownedCount: number }) {
  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.BOOK_VIEWED, { ownedCount });
  }, [ownedCount]);
  return null;
}
