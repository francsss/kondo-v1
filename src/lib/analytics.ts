import type { AnalyticsEventName, Prisma } from "@prisma/client";
import { logServerError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

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

  const productEvent = {
    SESSION_STARTED: PRODUCT_EVENTS.SESSION_STARTED,
    COMMUNITY_VIEWED: PRODUCT_EVENTS.COMMUNITY_OPENED,
    POST_CREATED: PRODUCT_EVENTS.COMMUNITY_POST_PUBLISHED,
    POST_REACTED: PRODUCT_EVENTS.COMMUNITY_POST_REACTED,
    LISTING_VIEWED: PRODUCT_EVENTS.MARKETPLACE_LISTING_VIEWED,
    LISTING_CONTACTED: PRODUCT_EVENTS.MARKETPLACE_VENDOR_CONTACTED,
    GUIDE_STARTED: PRODUCT_EVENTS.GUIDE_STARTED,
    GUIDE_STEP_COMPLETED: PRODUCT_EVENTS.GUIDE_STEP_COMPLETED,
    SEARCH_PERFORMED: PRODUCT_EVENTS.SEARCH_PERFORMED,
    USER_REGISTERED: PRODUCT_EVENTS.REGISTRATION_COMPLETED,
    USER_LOGGED_IN: PRODUCT_EVENTS.LOGIN_COMPLETED,
    COMMUNITY_CREATED: PRODUCT_EVENTS.COMMUNITY_CREATED,
    LISTING_CREATED: PRODUCT_EVENTS.MARKETPLACE_LISTING_PUBLISHED,
    MESSAGE_SENT: PRODUCT_EVENTS.MESSAGE_SENT,
    STUDENT_HUB_VIEWED: PRODUCT_EVENTS.STUDENT_HUB_OPENED,
    EXPLORE_CITY_VIEWED: PRODUCT_EVENTS.EXPLORE_CITY_OPENED,
    HOUSING_HOME_VIEWED: PRODUCT_EVENTS.HOUSING_HOME_VIEWED,
    HOUSING_SEARCH_STARTED: PRODUCT_EVENTS.HOUSING_SEARCH_STARTED,
    HOUSING_FILTER_APPLIED: PRODUCT_EVENTS.HOUSING_FILTER_APPLIED,
    HOUSING_MAP_OPENED: PRODUCT_EVENTS.HOUSING_MAP_OPENED,
    HOUSING_LISTING_VIEWED: PRODUCT_EVENTS.HOUSING_LISTING_VIEWED,
    HOUSING_LISTING_SAVED: PRODUCT_EVENTS.HOUSING_LISTING_SAVED,
    HOUSING_CONTACT_OPENED: PRODUCT_EVENTS.HOUSING_CONTACT_OPENED,
    HOUSING_INQUIRY_SENT: PRODUCT_EVENTS.HOUSING_INQUIRY_SENT,
    HOUSING_LISTING_CREATED: PRODUCT_EVENTS.HOUSING_LISTING_CREATION_STARTED,
    HOUSING_LISTING_SUBMITTED: PRODUCT_EVENTS.HOUSING_LISTING_SUBMITTED,
    HOUSING_LISTING_PUBLISHED: PRODUCT_EVENTS.HOUSING_LISTING_PUBLISHED,
    HOUSING_REQUEST_CREATED: PRODUCT_EVENTS.HOUSING_REQUEST_CREATED,
    HOUSING_REQUEST_VIEWED: PRODUCT_EVENTS.HOUSING_REQUEST_VIEWED,
    ROOMMATE_PROFILE_CREATED: PRODUCT_EVENTS.ROOMMATE_PROFILE_CREATED,
    ROOMMATE_DISCOVERY_VIEWED: PRODUCT_EVENTS.ROOMMATE_DISCOVERY_VIEWED,
    ROOMMATE_INTEREST_SENT: PRODUCT_EVENTS.ROOMMATE_INTEREST_SENT,
    ROOMMATE_INTEREST_ACCEPTED: PRODUCT_EVENTS.ROOMMATE_INTEREST_ACCEPTED,
    HOUSING_REPORT_SUBMITTED: PRODUCT_EVENTS.HOUSING_REPORT_SUBMITTED,
  } satisfies Record<AnalyticsEventName, string>;

  const rawProperties =
    input.properties &&
    typeof input.properties === "object" &&
    !Array.isArray(input.properties)
      ? (input.properties as Record<
          string,
          string | number | boolean | null | undefined
        >)
      : {};
  if (input.name !== "LISTING_CREATED" || rawProperties.published === true) {
    await captureServerProductEvent({
      distinctId: input.userId ?? input.sessionId,
      event: productEvent[input.name],
      properties: rawProperties,
    });
  }
}
