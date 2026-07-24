"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect, useRef } from "react";
import {
  captureProductEvent,
  identifyProductUser,
} from "@/lib/product-analytics-client";
import {
  normalizeAnalyticsRoute,
  productAreaForPath,
  PRODUCT_EVENTS,
  type ProductEventName,
} from "@/lib/product-analytics-events";

type AnalyticsUser = {
  id: string;
  role: string;
  country?: { code?: string; name?: string } | null;
  city?: { slug?: string; name?: string } | null;
  university?: { slug?: string; name?: string } | null;
  onboardingCompletedAt?: Date | string | null;
};

const KNOWN_EVENTS = new Set<string>(Object.values(PRODUCT_EVENTS));
const SLOW_API_THRESHOLD_MS = 2_000;

function captureWebVital(metric: {
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
}) {
  const thresholds: Record<string, number> = {
    LCP: 2_500,
    INP: 200,
    CLS: 0.1,
    FCP: 1_800,
    TTFB: 800,
  };
  const threshold = thresholds[metric.name];
  if (threshold === undefined || metric.value <= threshold) return;
  captureProductEvent(PRODUCT_EVENTS.PAGE_PERFORMANCE_SLOW, {
    metric: metric.name,
    value: Math.round(metric.value * 100) / 100,
    rating: metric.rating,
    navigation_type: metric.navigationType,
    route: normalizeAnalyticsRoute(window.location.pathname),
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function ProductAnalyticsLifecycle() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useReportWebVitals(captureWebVital);

  useEffect(() => {
    pathnameRef.current = pathname;
    const normalizedRoute = normalizeAnalyticsRoute(pathname);
    const area = productAreaForPath(pathname);
    const startedAt = performance.now();

    captureProductEvent(PRODUCT_EVENTS.PAGE_VIEWED, {
      $current_url: `${window.location.origin}${normalizedRoute}`,
      route: normalizedRoute,
      area,
    });
    if (pathname === "/") {
      captureProductEvent(PRODUCT_EVENTS.LANDING_VIEWED);
    } else if (pathname === "/student-hub") {
      captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_OPENED, {
        section: "guide",
      });
    } else if (pathname === "/student-hub/tools") {
      captureProductEvent(PRODUCT_EVENTS.STUDENT_HUB_OPENED, {
        section: "tools",
      });
    } else if (pathname === "/marketplace") {
      captureProductEvent(PRODUCT_EVENTS.MARKETPLACE_OPENED);
    } else if (pathname === "/home") {
      const arrivedAfterOnboarding =
        window.sessionStorage.getItem("kondo:onboarding-completed") === "1";
      if (arrivedAfterOnboarding) {
        captureProductEvent(PRODUCT_EVENTS.HOME_ARRIVED_AFTER_ONBOARDING);
        window.sessionStorage.removeItem("kondo:onboarding-completed");
      }
    }

    return () => {
      const durationSeconds =
        Math.round((performance.now() - startedAt) / 100) / 10;
      if (durationSeconds >= 2) {
        captureProductEvent(PRODUCT_EVENTS.FEATURE_TIME_SPENT, {
          area,
          route: normalizedRoute,
          duration_seconds: Math.min(durationSeconds, 24 * 60 * 60),
        });
      }
    };
  }, [pathname]);

  useEffect(() => {
    function onTrackedClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest<HTMLElement>("[data-product-event]");
      const productEvent = element?.dataset.productEvent;
      if (!productEvent || !KNOWN_EVENTS.has(productEvent)) return;
      captureProductEvent(productEvent as ProductEventName, {
        source: element.dataset.productSource,
        destination: element.dataset.productDestination,
      });
    }

    document.addEventListener("click", onTrackedClick);
    return () => document.removeEventListener("click", onTrackedClick);
  }, []);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);

    async function monitoredFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      const rawUrl = requestUrl(input);
      const url = new URL(rawUrl, window.location.origin);
      const shouldMeasure =
        url.origin === window.location.origin &&
        url.pathname.startsWith("/api/") &&
        !url.pathname.startsWith("/api/presence/");
      if (!shouldMeasure) return nativeFetch(input, init);

      const startedAt = performance.now();
      try {
        const response = await nativeFetch(input, init);
        const durationMs = Math.round(performance.now() - startedAt);
        const method =
          init?.method ??
          (typeof Request !== "undefined" && input instanceof Request
            ? input.method
            : "GET");
        const properties = {
          api_route: normalizeAnalyticsRoute(url.pathname),
          method: method.toUpperCase(),
          status: response.status,
          duration_ms: durationMs,
          page_route: normalizeAnalyticsRoute(pathnameRef.current),
        };
        const operationalFailure =
          !response.ok &&
          (response.status >= 500 ||
            response.status === 408 ||
            response.status === 429);
        if (operationalFailure) {
          captureProductEvent(PRODUCT_EVENTS.API_REQUEST_FAILED, properties);
        } else if (response.ok && durationMs >= SLOW_API_THRESHOLD_MS) {
          captureProductEvent(PRODUCT_EVENTS.API_REQUEST_SLOW, properties);
        }
        if (
          !response.ok &&
          (url.pathname.includes("/uploads") ||
            url.pathname.includes("/imports"))
        ) {
          captureProductEvent(PRODUCT_EVENTS.UPLOAD_FAILED, properties);
        }
        return response;
      } catch (error) {
        const durationMs = Math.round(performance.now() - startedAt);
        captureProductEvent(PRODUCT_EVENTS.API_REQUEST_FAILED, {
          api_route: normalizeAnalyticsRoute(url.pathname),
          method: (
            init?.method ??
            (typeof Request !== "undefined" && input instanceof Request
              ? input.method
              : "GET")
          ).toUpperCase(),
          status: 0,
          duration_ms: durationMs,
          error_type:
            error instanceof DOMException ? error.name : "NetworkError",
          page_route: normalizeAnalyticsRoute(pathnameRef.current),
        });
        throw error;
      }
    }

    window.fetch = monitoredFetch;
    return () => {
      window.fetch = nativeFetch;
    };
  }, []);

  useEffect(() => {
    function onError(event: ErrorEvent) {
      captureProductEvent(PRODUCT_EVENTS.JAVASCRIPT_ERROR, {
        error_type: event.error?.name ?? "Error",
        source_file: event.filename
          ? event.filename.split("/").pop()
          : "unknown",
        line: event.lineno,
        column: event.colno,
        route: normalizeAnalyticsRoute(pathnameRef.current),
      });
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      captureProductEvent(PRODUCT_EVENTS.JAVASCRIPT_ERROR, {
        error_type:
          event.reason instanceof Error
            ? event.reason.name
            : "UnhandledPromiseRejection",
        route: normalizeAnalyticsRoute(pathnameRef.current),
      });
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

export function ProductAnalyticsIdentity({ user }: { user: AnalyticsUser }) {
  useEffect(() => {
    identifyProductUser(user.id, {
      role: user.role,
      country_code: user.country?.code,
      country: user.country?.name,
      city_slug: user.city?.slug,
      city: user.city?.name,
      university_slug: user.university?.slug,
      university: user.university?.name,
      onboarding_completed: Boolean(user.onboardingCompletedAt),
    });
  }, [user]);
  return null;
}
