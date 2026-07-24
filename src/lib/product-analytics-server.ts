import { PostHog } from "posthog-node";
import { logServerError } from "@/lib/logger";
import {
  sanitizeProductProperties,
  type ProductEventName,
  type ProductEventProperties,
} from "@/lib/product-analytics-events";

export async function captureServerProductEvent(input: {
  distinctId: string | null | undefined;
  event: ProductEventName;
  properties?: ProductEventProperties;
}) {
  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken || !input.distinctId) return;

  const client = new PostHog(projectToken, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    requestTimeout: 800,
  });
  try {
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: {
        ...sanitizeProductProperties(input.properties),
        source: "server",
      },
    });
    await client.shutdown();
  } catch (error) {
    logServerError("analytics.posthog", error, { event: input.event });
  }
}
