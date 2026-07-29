const FALLBACK_PATH = "/notifications";

function safePath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return FALLBACK_PATH;
  }
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : FALLBACK_PATH;
  } catch {
    return FALLBACK_PATH;
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let payload = {};
      try {
        payload = event.data?.json() ?? {};
      } catch {
        payload = {
          title: "New update",
          body: event.data?.text() ?? "Open Kondo to view your update.",
        };
      }
      const notification = {
        id: String(payload.id ?? crypto.randomUUID()),
        type: String(payload.type ?? "ACCOUNT"),
        templateKey:
          typeof payload.templateKey === "string" ? payload.templateKey : null,
        kind: String(payload.kind ?? "SYSTEM_UPDATE"),
        title: String(payload.title ?? "New update"),
        body:
          typeof payload.body === "string"
            ? payload.body
            : "Open Kondo to view your update.",
        href: safePath(payload.href),
        category: String(payload.category ?? "system"),
        actionLabel: String(payload.actionLabel ?? "Open Kondo"),
        createdAt: String(payload.createdAt ?? new Date().toISOString()),
        feedback: {
          sound: payload.feedback?.sound === true,
          haptics: payload.feedback?.haptics !== false,
        },
      };
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const visibleWindows = windows.filter(
        (client) => client.visibilityState === "visible",
      );
      if (visibleWindows.length) {
        for (const client of visibleWindows) {
          client.postMessage({
            type: "KONDO_NOTIFICATION",
            notification,
          });
        }
        return;
      }
      const parsedTimestamp = Date.parse(notification.createdAt);
      await self.registration.showNotification(
        `Kondo · ${notification.title}`,
        {
          body: notification.body,
          icon: "/kondo-mark.svg",
          badge: "/kondo-mark.svg",
          tag: notification.id,
          renotify: false,
          silent: !notification.feedback.sound,
          timestamp: Number.isFinite(parsedTimestamp)
            ? parsedTimestamp
            : Date.now(),
          vibrate: notification.feedback.haptics ? [35] : [],
          data: {
            href: notification.href,
            notificationId: notification.id,
          },
          actions: [
            {
              action: "open",
              title: notification.actionLabel,
            },
          ],
        },
      );
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = safePath(event.notification.data?.href);
  event.waitUntil(
    (async () => {
      const targetUrl = new URL(targetPath, self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if ("navigate" in client) await client.navigate(targetUrl);
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});
