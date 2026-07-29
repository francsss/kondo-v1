"use client";

export const NOTIFICATION_COUNT_EVENT = "kondo:notification-count";
export const MESSAGE_COUNT_EVENT = "kondo:message-count";

export function broadcastNotificationCount(unreadCount: number) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_COUNT_EVENT, {
      detail: { unreadCount: Math.max(0, Math.floor(unreadCount)) },
    }),
  );
}

export function adjustNotificationCount(delta: number) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_COUNT_EVENT, {
      detail: { delta: Math.trunc(delta) },
    }),
  );
}

export function broadcastMessageCount(unreadCount: number) {
  window.dispatchEvent(
    new CustomEvent(MESSAGE_COUNT_EVENT, {
      detail: { unreadCount: Math.max(0, Math.floor(unreadCount)) },
    }),
  );
}

export function adjustMessageCount(delta: number) {
  window.dispatchEvent(
    new CustomEvent(MESSAGE_COUNT_EVENT, {
      detail: { delta: Math.trunc(delta) },
    }),
  );
}

export function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll("-", "+").replaceAll("_", "/");
  const decoded = window.atob(base64);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export function browserPushIsSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
