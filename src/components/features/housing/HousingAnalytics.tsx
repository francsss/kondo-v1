"use client";

import { useEffect, useRef } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import {
  PRODUCT_EVENTS,
  type ProductEventName,
} from "@/lib/product-analytics-events";

export function HousingAnalytics({
  disabled = false,
  event,
  properties,
}: {
  disabled?: boolean;
  event: ProductEventName;
  properties?: Record<string, string | number | boolean | null>;
}) {
  const captured = useRef(false);
  useEffect(() => {
    if (disabled || captured.current) return;
    captured.current = true;
    captureProductEvent(event, properties);
  }, [disabled, event, properties]);
  return null;
}

export const HOUSING_ANALYTICS_EVENTS = PRODUCT_EVENTS;
