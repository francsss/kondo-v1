"use client";

import posthog from "posthog-js";
import {
  sanitizeProductProperties,
  type ProductEventName,
  type ProductEventProperties,
} from "@/lib/product-analytics-events";

export function productAnalyticsEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN);
}

export function captureProductEvent(
  event: ProductEventName,
  properties: ProductEventProperties = {},
) {
  if (!productAnalyticsEnabled()) return;
  posthog.capture(event, sanitizeProductProperties(properties));
}

export function identifyProductUser(
  userId: string,
  properties: ProductEventProperties,
) {
  if (!productAnalyticsEnabled()) return;
  posthog.identify(userId, { $set: sanitizeProductProperties(properties) });
}

export function resetProductAnalytics() {
  if (!productAnalyticsEnabled()) return;
  posthog.reset();
}
