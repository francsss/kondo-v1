import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORIGIN = "https://joinkondo.com";

type PushHandler = (event: {
  data: { json: () => unknown; text: () => string } | null;
  waitUntil: (value: Promise<unknown>) => void;
}) => void;

type ClickHandler = (event: {
  notification: { close: () => void; data: unknown };
  waitUntil: (value: Promise<unknown>) => void;
}) => void;

type ShownNotification = {
  body: string;
  icon: string;
  badge: string;
  tag: string;
  silent: boolean;
  timestamp: number;
  vibrate: number[];
  data: { href: string; notificationId: string };
  actions: { action: string; title: string }[];
};

/**
 * The worker ships as a plain script served from /kondo-sw.js, so it cannot be
 * imported. Evaluating the real file keeps this test honest about the code that
 * actually reaches the browser instead of a copy of its logic.
 */
function loadServiceWorker(clients: unknown[]) {
  const listeners = new Map<string, unknown>();
  const showNotification =
    vi.fn<(title: string, options: ShownNotification) => Promise<void>>();
  const openWindow = vi.fn<(url: string) => Promise<void>>();

  const self = {
    addEventListener: (type: string, handler: unknown) => {
      listeners.set(type, handler);
    },
    location: { origin: ORIGIN },
    registration: { showNotification },
    clients: {
      matchAll: async () => clients,
      openWindow,
    },
  };

  const context = createContext({
    self,
    crypto: { randomUUID: () => "generated-id" },
    URL,
    console,
  });
  runInContext(
    readFileSync(new URL("../../public/kondo-sw.js", import.meta.url), "utf8"),
    context,
  );

  return {
    push: listeners.get("push") as PushHandler,
    click: listeners.get("notificationclick") as ClickHandler,
    showNotification,
    openWindow,
  };
}

async function dispatchPush(
  worker: ReturnType<typeof loadServiceWorker>,
  payload: unknown,
) {
  const pending: Promise<unknown>[] = [];
  worker.push({
    data: {
      json: () => payload,
      text: () => JSON.stringify(payload),
    },
    waitUntil: (value) => void pending.push(value),
  });
  await Promise.all(pending);
}

function visibleClient() {
  return {
    visibilityState: "visible",
    postMessage: vi.fn(),
    navigate: vi.fn(async () => undefined),
    focus: vi.fn(async () => undefined),
  };
}

function hiddenClient() {
  return {
    visibilityState: "hidden",
    postMessage: vi.fn(),
    navigate: vi.fn(async () => undefined),
    focus: vi.fn(async () => undefined),
  };
}

describe("Kondo push service worker", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hands the notification to an open Kondo tab instead of the OS", async () => {
    const client = visibleClient();
    const worker = loadServiceWorker([client]);

    await dispatchPush(worker, {
      id: "notification-1",
      kind: "NEW_MESSAGE",
      title: "Sarah sent you a message",
      body: "Are you still at the library?",
      href: "/messages/thread-1",
      category: "messages",
      actionLabel: "Open chat",
    });

    expect(worker.showNotification).not.toHaveBeenCalled();
    expect(client.postMessage).toHaveBeenCalledWith({
      type: "KONDO_NOTIFICATION",
      notification: expect.objectContaining({
        id: "notification-1",
        title: "Sarah sent you a message",
        href: "/messages/thread-1",
        category: "messages",
      }),
    });
  });

  it("shows a branded OS notification when no tab is visible", async () => {
    const worker = loadServiceWorker([hiddenClient()]);

    await dispatchPush(worker, {
      id: "notification-2",
      title: "Upcoming class",
      body: "Artificial Intelligence starts in 10 minutes.",
      href: "/student-hub",
      actionLabel: "View schedule",
      createdAt: "2026-07-29T08:00:00.000Z",
      feedback: { sound: false, haptics: true },
    });

    expect(worker.showNotification).toHaveBeenCalledTimes(1);
    const [title, options] = worker.showNotification.mock.calls[0];
    expect(title).toBe("Kondo · Upcoming class");
    expect(options).toMatchObject({
      body: "Artificial Intelligence starts in 10 minutes.",
      icon: "/kondo-mark.svg",
      badge: "/kondo-mark.svg",
      tag: "notification-2",
      silent: true,
      timestamp: new Date("2026-07-29T08:00:00.000Z").getTime(),
      vibrate: [35],
      data: { href: "/student-hub", notificationId: "notification-2" },
      actions: [{ action: "open", title: "View schedule" }],
    });
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "not-a-path",
    "",
  ])("refuses to deep-link a push payload pointing at %s", async (href) => {
    const worker = loadServiceWorker([hiddenClient()]);

    await dispatchPush(worker, { id: "notification-3", title: "Hi", href });

    const [, options] = worker.showNotification.mock.calls[0];
    expect(options.data.href).toBe("/notifications");
  });

  it("falls back to a readable notification when the payload is not JSON", async () => {
    const worker = loadServiceWorker([hiddenClient()]);
    const pending: Promise<unknown>[] = [];
    worker.push({
      data: {
        json: () => {
          throw new Error("not json");
        },
        text: () => "Something happened",
      },
      waitUntil: (value) => void pending.push(value),
    });
    await Promise.all(pending);

    const [title, options] = worker.showNotification.mock.calls[0];
    expect(title).toBe("Kondo · New update");
    expect(options.body).toBe("Something happened");
    expect(options.data.href).toBe("/notifications");
  });

  it("focuses an existing tab on the safe destination when clicked", async () => {
    const client = visibleClient();
    const worker = loadServiceWorker([client]);
    const pending: Promise<unknown>[] = [];

    worker.click({
      notification: {
        close: vi.fn(),
        data: { href: "/messages/thread-1" },
      },
      waitUntil: (value) => void pending.push(value),
    });
    await Promise.all(pending);

    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/messages/thread-1`);
    expect(client.focus).toHaveBeenCalled();
    expect(worker.openWindow).not.toHaveBeenCalled();
  });

  it("opens a new window on the fallback route for an unsafe click target", async () => {
    const worker = loadServiceWorker([]);
    const pending: Promise<unknown>[] = [];

    worker.click({
      notification: {
        close: vi.fn(),
        data: { href: "https://evil.example/phish" },
      },
      waitUntil: (value) => void pending.push(value),
    });
    await Promise.all(pending);

    expect(worker.openWindow).toHaveBeenCalledWith(`${ORIGIN}/notifications`);
  });
});
