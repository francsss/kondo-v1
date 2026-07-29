"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationIcon } from "@/components/features/notifications/NotificationIcon";
import { notificationPresentation } from "@/features/notifications/presentation";
import {
  adjustMessageCount,
  broadcastNotificationCount,
} from "@/lib/notification-client";

type LiveNotification = {
  id: string;
  type: string;
  templateKey: string | null;
  kind?: string | null;
  title: string;
  body: string | null;
  href: string | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationListPayload = {
  unreadCount?: number;
  notifications?: LiveNotification[];
};

function playFeedback({
  sound,
  haptics,
}: {
  sound: boolean;
  haptics: boolean;
}) {
  if (haptics && "vibrate" in navigator) {
    navigator.vibrate(18);
  }
  if (!sound) return;
  try {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.055, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    gain.connect(context.destination);
    for (const [frequency, delay] of [
      [587, 0],
      [784, 0.12],
    ] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.28);
    }
    window.setTimeout(() => void context.close(), 700);
  } catch {
    // Browsers may block audio before the first user gesture. The notification
    // remains fully functional and haptics are handled independently.
  }
}

function KondoNotificationBanner({
  notification,
  onDismiss,
  onOpen,
}: {
  notification: LiveNotification;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const presentation = notificationPresentation(notification);

  useEffect(() => {
    if (paused) return;
    const timeout = window.setTimeout(onDismiss, 6_500);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, paused]);

  return (
    <motion.article
      aria-atomic="true"
      aria-label={`${notification.title}. ${notification.body ?? ""}`}
      className="pointer-events-auto relative w-full overflow-hidden rounded-[1.6rem] border border-white/70 bg-card/95 p-4 text-card-foreground shadow-[0_24px_80px_rgba(8,32,26,0.24)] backdrop-blur-2xl dark:border-white/10"
      drag={reducedMotion ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      exit={
        reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -18 }
      }
      initial={
        reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -28 }
      }
      animate={{ opacity: 1, scale: 1, y: 0 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 650) {
          onDismiss();
        }
      }}
      onHoverEnd={() => setPaused(false)}
      onHoverStart={() => setPaused(true)}
      role="status"
      transition={{ type: "spring", stiffness: 340, damping: 29 }}
    >
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-kondo-green via-emerald-300 to-kondo-lime" />
      <button
        aria-label="Dismiss notification"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        onClick={onDismiss}
        type="button"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        className="flex w-full items-start gap-3 pr-9 text-left"
        onClick={onOpen}
        type="button"
      >
        <div className="relative">
          <NotificationIcon
            category={presentation.category}
            icon={presentation.icon}
          />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-lg border-2 border-card bg-kondo-green text-[9px] font-black text-white">
            K
          </span>
        </div>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.13em] text-kondo-green">
              Kondo
            </span>
            <span className="text-[10px] text-muted-foreground">Now</span>
          </span>
          <strong className="mt-1 block truncate text-sm">
            {notification.title}
          </strong>
          {notification.body ? (
            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
              {notification.body}
            </span>
          ) : null}
          {notification.href ? (
            <span className="mt-2 inline-flex text-[11px] font-black text-kondo-green">
              {presentation.actionLabel} →
            </span>
          ) : null}
        </span>
      </button>
    </motion.article>
  );
}

export function NotificationExperience({
  soundEnabled,
  hapticsEnabled,
}: {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}) {
  const router = useRouter();
  const knownIdsRef = useRef(new Set<string>());
  const initializedRef = useRef(false);
  const [banners, setBanners] = useState<LiveNotification[]>([]);

  const receiveNotification = useCallback(
    (notification: LiveNotification) => {
      if (!notification.id || knownIdsRef.current.has(notification.id)) return;
      knownIdsRef.current.add(notification.id);
      setBanners((current) => [...current, notification].slice(-3));
      if (notificationPresentation(notification).category === "messages") {
        adjustMessageCount(1);
      }
      playFeedback({ sound: soundEnabled, haptics: hapticsEnabled });
    },
    [hapticsEnabled, soundEnabled],
  );

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/kondo-sw.js", { scope: "/" })
      .catch(() => undefined);
    const onMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "KONDO_NOTIFICATION" &&
        event.data.notification
      ) {
        receiveNotification(event.data.notification as LiveNotification);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [receiveNotification]);

  useEffect(() => {
    let disposed = false;
    let timeout = 0;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        const response = await fetch("/api/notifications?page=1&pageSize=5", {
          credentials: "include",
          cache: "no-store",
        }).catch(() => null);
        if (response?.ok) {
          const payload = (await response
            .json()
            .catch(() => ({}))) as NotificationListPayload;
          broadcastNotificationCount(payload.unreadCount ?? 0);
          const notifications = payload.notifications ?? [];
          if (initializedRef.current) {
            for (const notification of [...notifications].reverse()) {
              if (!notification.readAt) receiveNotification(notification);
            }
          } else {
            for (const notification of notifications) {
              knownIdsRef.current.add(notification.id);
            }
            initializedRef.current = true;
          }
        }
      }
      if (!disposed) timeout = window.setTimeout(poll, 20_000);
    };
    void poll();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(timeout);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [receiveNotification]);

  const dismiss = useCallback((id: string) => {
    setBanners((current) =>
      current.filter((notification) => notification.id !== id),
    );
  }, []);

  async function open(notification: LiveNotification) {
    dismiss(notification.id);
    await fetch(`/api/notifications/${notification.id}/read`, {
      method: "PATCH",
      credentials: "include",
      keepalive: true,
    }).catch(() => null);
    router.push(notification.href ?? "/notifications");
    router.refresh();
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] mx-auto flex max-w-md flex-col gap-3 sm:top-4"
    >
      <AnimatePresence initial={false}>
        {banners.map((notification) => (
          <KondoNotificationBanner
            key={notification.id}
            notification={notification}
            onDismiss={() => dismiss(notification.id)}
            onOpen={() => void open(notification)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
