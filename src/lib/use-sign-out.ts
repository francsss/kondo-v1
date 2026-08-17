"use client";

import { useCallback, useRef, useState } from "react";
import { resetProductAnalytics } from "@/lib/product-analytics-client";

/**
 * Signing out, in one place.
 *
 * There were two copies of this: the shell menus and the settings screen. They
 * had drifted — one surfaced failures, the other did not — so both live here
 * now and behave identically wherever the action appears.
 *
 * Three things this fixes over the previous shell implementation:
 *
 * Failure was silent. The old code was `if (response?.ok) { redirect }` with
 * no else, so a failed request left the button looking untouched and the
 * session alive. Tapping Sign Out appeared to do nothing at all. A failure now
 * says so and lets the student try again.
 *
 * Push cleanup could block it. Unsubscribing from push was awaited before the
 * logout request, so a slow or wedged service worker held the whole action
 * with no feedback on screen. It is now bounded and best-effort: releasing the
 * push subscription is a courtesy to the device, never a precondition for
 * ending a session.
 *
 * Back could go back. `location.assign` left the authenticated page in
 * history, so Back re-displayed it from cache. `location.replace` drops it,
 * and the no-store header set in `proxy.ts` keeps the browser from
 * restoring an authenticated document it should no longer have.
 */

/** How long push cleanup may take before sign-out stops waiting for it. */
const PUSH_CLEANUP_TIMEOUT_MS = 1200;

async function releasePushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker
    .getRegistration("/")
    .catch(() => undefined);
  const subscription = await registration?.pushManager
    .getSubscription()
    .catch(() => null);
  if (!subscription) return;
  await fetch("/api/notifications/push", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => null);
  await subscription.unsubscribe().catch(() => false);
}

export function useSignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // Ref rather than state: the guard has to hold within a single tick, before
  // React has re-rendered with `pending`.
  const running = useRef(false);

  const signOut = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setPending(true);
    setError("");

    // Bounded and non-fatal — see the note above.
    await Promise.race([
      releasePushSubscription(),
      new Promise((resolve) => setTimeout(resolve, PUSH_CLEANUP_TIMEOUT_MS)),
    ]).catch(() => undefined);

    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => null);

    if (!response?.ok) {
      const body = (await response?.json().catch(() => ({}))) as {
        error?: string;
      };
      running.current = false;
      setPending(false);
      setError(body?.error ?? "Sign out failed. Check your connection.");
      return;
    }

    resetProductAnalytics();
    // `replace`, not `assign`: the authenticated page must not stay one Back
    // press away.
    window.location.replace("/login");
  }, []);

  return { signOut, pending, error };
}
