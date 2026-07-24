"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/presence-shared";

const SESSION_KEY = "kondo:presence-session";

function getClientSessionId() {
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const lastSentAtRef = useRef(0);

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let stopped = false;
    const sessionId = getClientSessionId();

    function sendHeartbeat() {
      if (stopped) return;
      lastSentAtRef.current = Date.now();
      void fetch("/api/presence/heartbeat", {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientSessionId: sessionId,
          currentPath: pathRef.current,
        }),
      }).catch(() => undefined);
    }

    function onVisibilityChange() {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastSentAtRef.current >= PRESENCE_HEARTBEAT_MS
      ) {
        sendHeartbeat();
      }
    }

    sendHeartbeat();
    const interval = window.setInterval(sendHeartbeat, PRESENCE_HEARTBEAT_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
