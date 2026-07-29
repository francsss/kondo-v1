"use client";

import {
  BellRing,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  base64UrlToUint8Array,
  browserPushIsSupported,
} from "@/lib/notification-client";
import { cn } from "@/lib/utils";

type PushState =
  | "checking"
  | "unsupported"
  | "unconfigured"
  | "disabled"
  | "enabled"
  | "denied"
  | "saving";

export function PushNotificationControl() {
  const publicKey =
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const [state, setState] = useState<PushState>("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const check = async () => {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (!browserPushIsSupported()) {
        setState("unsupported");
        return;
      }
      if (!publicKey) {
        setState("unconfigured");
        return;
      }
      try {
        const response = await fetch("/api/notifications/push", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (!response.ok || !payload.configured) {
          setState("unconfigured");
          return;
        }
        setState(payload.enabled ? "enabled" : "disabled");
      } catch {
        if (!controller.signal.aborted) setState("disabled");
      }
    };
    void check();
    return () => controller.abort();
  }, [publicKey]);

  async function enable() {
    if (!browserPushIsSupported() || !publicKey) return;
    setState("saving");
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setMessage(
          "Permission was not granted. You can change it in your browser settings.",
        );
        return;
      }
      const registration = await navigator.serviceWorker.register(
        "/kondo-sw.js",
        { scope: "/" },
      );
      await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));
      const response = await fetch("/api/notifications/push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Push notifications were not enabled.",
        );
      }
      setState("enabled");
      setMessage("This device can now receive Kondo notifications.");
    } catch (error) {
      setState("disabled");
      setMessage(
        error instanceof Error
          ? error.message
          : "Push notifications were not enabled.",
      );
    }
  }

  async function disable() {
    setState("saving");
    setMessage("");
    const registration = await navigator.serviceWorker
      .getRegistration("/")
      .catch(() => undefined);
    const subscription = await registration?.pushManager
      .getSubscription()
      .catch(() => null);
    const response = await fetch("/api/notifications/push", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription?.endpoint }),
    }).catch(() => null);
    if (response?.ok) {
      await subscription?.unsubscribe().catch(() => false);
      setState("disabled");
      setMessage("Push notifications are disabled on this device.");
    } else {
      setState("enabled");
      setMessage("Kondo could not disable push notifications. Try again.");
    }
  }

  const enabled = state === "enabled";
  const loading = state === "checking" || state === "saving";

  return (
    <section className="relative overflow-hidden rounded-3xl border border-kondo-green/20 bg-gradient-to-br from-kondo-forest to-[#071f1a] p-5 text-white shadow-[0_18px_55px_rgba(6,60,49,0.2)] sm:p-6">
      <div className="absolute -right-14 -top-20 h-44 w-44 rounded-full bg-emerald-300/10 blur-2xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid h-12 w-12 shrink-0 place-items-center rounded-2xl border",
              enabled
                ? "border-kondo-lime/40 bg-kondo-lime/15 text-kondo-lime"
                : "border-white/15 bg-white/10 text-white",
            )}
          >
            {enabled ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <BellRing className="h-5 w-5" />
            )}
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200">
              Kondo on this device
            </p>
            <h2 className="mt-1 text-lg font-black">
              {enabled ? "Push notifications are active" : "Stay connected"}
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-white/65">
              Receive recognizable Kondo updates even when the application is
              closed. Exact private content remains protected by your device.
            </p>
          </div>
        </div>
        <Button
          className="border-white/20 bg-white text-kondo-forest hover:bg-white/90"
          disabled={
            loading || state === "unsupported" || state === "unconfigured"
          }
          onClick={() => void (enabled ? disable() : enable())}
          type="button"
          variant="secondary"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          {state === "checking" || state === "saving"
            ? "Checking…"
            : enabled
              ? "Disable on this device"
              : "Enable push"}
        </Button>
      </div>
      <div className="relative mt-4 flex items-start gap-2 text-xs text-white/55">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
        <p aria-live="polite">
          {state === "unsupported"
            ? "This browser does not support Web Push. On iPhone, install Kondo on the Home Screen first."
            : state === "unconfigured"
              ? "Web Push is not configured for this deployment yet."
              : state === "denied"
                ? message
                : message ||
                  "You can disable this device at any time. Signing out also removes its subscription."}
        </p>
      </div>
    </section>
  );
}
