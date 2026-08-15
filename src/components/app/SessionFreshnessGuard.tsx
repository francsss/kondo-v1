"use client";

import { useEffect } from "react";

/**
 * Don't let the back button show a signed-out student their own account.
 *
 * Signing out revokes the session, clears the cookie and replaces the current
 * history entry — but earlier entries survive, and the browser restores them
 * from the back/forward cache without asking the server. Pressing Back twice
 * after signing out brought `/home` back complete with the navigation and the
 * account name. The session was gone; the page was still there.
 *
 * The usual cure is `Cache-Control: no-store`. It is not available here: Next
 * sets `no-cache, must-revalidate` on its own rendered app-router responses and
 * overwrites that one header afterwards, so neither `headers()` in the config
 * nor `proxy.ts` can change it (other headers set there do survive — this is
 * specific to Cache-Control).
 *
 * Measured, the restore is not bfcache either. `pageshow` reports
 * `persisted: false` and a real document request appears, because browsers
 * deliberately reuse the HTTP cache for history navigations and skip
 * revalidation — which is exactly what `must-revalidate` fails to prevent.
 *
 * So both restore paths are covered from the client, and only those: a
 * back/forward navigation, per the Navigation Timing type, or a genuine
 * bfcache restore. One small request, on Back only, and only a definite 401
 * moves the student. A normal load never checks, so nothing is spent on the
 * common path.
 */

async function redirectIfSignedOut() {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  }).catch(() => null);
  // Only a definite "not signed in" moves anybody. A network failure must not
  // throw a signed-in student out of their own session.
  if (response?.status === 401) window.location.replace("/login");
}

export function SessionFreshnessGuard() {
  useEffect(() => {
    const [entry] = performance.getEntriesByType(
      "navigation",
    ) as PerformanceNavigationTiming[];
    if (entry?.type === "back_forward") void redirectIfSignedOut();

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void redirectIfSignedOut();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return null;
}
