"use client";

import { useEffect } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import {
  PRODUCT_EVENTS,
  type ProductEventName,
} from "@/lib/product-analytics-events";

const entryEvents: Record<string, ProductEventName | undefined> = {
  company: PRODUCT_EVENTS.EXPLORE_COMPANY_VIEWED,
  opportunity: PRODUCT_EVENTS.EXPLORE_INTERNSHIP_VIEWED,
  event: PRODUCT_EVENTS.EXPLORE_EVENT_VIEWED,
  restaurant: PRODUCT_EVENTS.EXPLORE_RESTAURANT_VIEWED,
  housing: PRODUCT_EVENTS.EXPLORE_HOUSING_VIEWED,
};

export function ExploreSectionAnalytics({
  citySlug,
  sectionSlug,
}: {
  citySlug: string;
  sectionSlug: string;
}) {
  useEffect(() => {
    captureProductEvent(PRODUCT_EVENTS.EXPLORE_CATEGORY_OPENED, {
      city_slug: citySlug,
      category: sectionSlug,
    });

    const seen = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          const element = entry.target as HTMLElement;
          const id = element.dataset.exploreEntryId;
          const type = element.dataset.exploreEntryType;
          if (!id || !type || seen.has(id)) continue;
          seen.add(id);
          const event = entryEvents[type];
          if (event) {
            captureProductEvent(event, {
              city_slug: citySlug,
              category: sectionSlug,
              entry_type: type,
            });
          }
          observer.unobserve(element);
        }
      },
      { threshold: [0.5] },
    );
    const elements = document.querySelectorAll<HTMLElement>(
      "[data-explore-entry-id]",
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [citySlug, sectionSlug]);

  return null;
}
