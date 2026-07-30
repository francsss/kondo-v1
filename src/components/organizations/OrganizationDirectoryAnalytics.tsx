"use client";

import { useEffect, useRef } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function OrganizationDirectoryAnalytics({
  filtered,
  resultCount,
  filterCategories,
}: {
  filtered: boolean;
  resultCount: number;
  filterCategories: string[];
}) {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_DIRECTORY_VIEWED, {
      result_count: resultCount,
    });
    if (filtered) {
      captureProductEvent(PRODUCT_EVENTS.ORGANIZATION_DIRECTORY_FILTERED, {
        filter_categories: filterCategories.join(","),
        result_count: resultCount,
      });
    }
  }, [filterCategories, filtered, resultCount]);

  return null;
}
