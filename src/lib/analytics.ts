import type { AnalyticsEventName, Prisma } from "@prisma/client";
import { logServerError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type TrackEventInput = {
  name: AnalyticsEventName;
  userId?: string | null;
  sessionId?: string | null;
  properties?: Prisma.InputJsonValue;
};

/**
 * Records one row in the constrained AnalyticsEvent taxonomy. Never throws:
 * a failed analytics write must not break the user-facing action it is
 * attached to, so errors are logged and swallowed rather than propagated.
 */
export async function trackEvent(input: TrackEventInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        properties: input.properties,
      },
    });
  } catch (error) {
    logServerError("analytics.track", error, { name: input.name });
  }
}
