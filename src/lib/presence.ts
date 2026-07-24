import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  PRESENCE_ONLINE_WINDOW_MS,
  type PresenceSnapshot,
} from "@/lib/presence-shared";
import { prisma } from "@/lib/prisma";

export const presenceHeartbeatSchema = z.object({
  clientSessionId: z
    .string()
    .trim()
    .min(8)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  currentPath: z.string().trim().min(1).max(240),
});

type HeartbeatInput = z.infer<typeof presenceHeartbeatSchema> & {
  userId: string;
  userAgent?: string | null;
  now?: Date;
};

export interface PresenceStore {
  heartbeat(input: HeartbeatInput): Promise<void>;
  listOnline(now?: Date): Promise<PresenceSnapshot[]>;
}

function boundedLabel(value: string) {
  return value.slice(0, 32);
}

export function parseUserAgent(userAgent?: string | null) {
  const value = userAgent ?? "";

  const device = /iPad|Tablet|PlayBook|Silk/i.test(value)
    ? "Tablet"
    : /Mobi|Android|iPhone|iPod/i.test(value)
      ? "Mobile"
      : "Desktop";

  const browser = /Edg\//i.test(value)
    ? "Edge"
    : /OPR\/|Opera/i.test(value)
      ? "Opera"
      : /SamsungBrowser/i.test(value)
        ? "Samsung Internet"
        : /Firefox\/|FxiOS\//i.test(value)
          ? "Firefox"
          : /Chrome\/|CriOS\//i.test(value)
            ? "Chrome"
            : /Safari\//i.test(value)
              ? "Safari"
              : "Other";

  const operatingSystem = /iPhone|iPad|iPod/i.test(value)
    ? "iOS"
    : /Android/i.test(value)
      ? "Android"
      : /Windows NT/i.test(value)
        ? "Windows"
        : /CrOS/i.test(value)
          ? "Chrome OS"
          : /Mac OS X|Macintosh/i.test(value)
            ? "macOS"
            : /Linux/i.test(value)
              ? "Linux"
              : "Other";

  return {
    device: boundedLabel(device),
    browser: boundedLabel(browser),
    operatingSystem: boundedLabel(operatingSystem),
  };
}

const PRIVATE_ROUTE_PATTERNS: Array<[RegExp, string]> = [
  [/^\/messages\/[^/]+/, "/messages/[conversation]"],
  [/^\/profile\/[^/]+/, "/profile/[member]"],
  [/^\/communities\/[^/]+\/manage/, "/communities/[community]/manage"],
  [/^\/communities\/[^/]+/, "/communities/[community]"],
  [/^\/marketplace\/[^/]+\/edit/, "/marketplace/[listing]/edit"],
  [/^\/marketplace\/[^/]+/, "/marketplace/[listing]"],
  [/^\/guides\/[^/]+/, "/guides/[guide]"],
  [/^\/help\/[^/]+/, "/help/[question]"],
  [/^\/admin\/users\/[^/]+/, "/admin/users/[member]"],
  [/^\/admin\/reports\/[^/]+/, "/admin/reports/[report]"],
  [/^\/admin\/media\/[^/]+/, "/admin/media/[asset]"],
];

export function normalizePresencePath(input: string) {
  let pathname = "/";
  try {
    pathname = new URL(input, "https://kondo.invalid").pathname;
  } catch {
    pathname = input.split(/[?#]/, 1)[0] || "/";
  }

  pathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
  for (const [pattern, replacement] of PRIVATE_ROUTE_PATTERNS) {
    if (pattern.test(pathname)) return replacement;
  }
  return pathname.slice(0, 240);
}

export function describePresencePath(path: string) {
  if (path === "/home") return "Home";
  if (path.startsWith("/communities/")) return "Community";
  if (path === "/communities") return "Communities";
  if (path.startsWith("/marketplace/")) return "Marketplace listing";
  if (path === "/marketplace") return "Marketplace";
  if (path.startsWith("/messages/")) return "Conversation";
  if (path === "/messages") return "Messages";
  if (path.startsWith("/student-hub")) return "Student Hub";
  if (path.startsWith("/explore/")) return "Explore city";
  if (path.startsWith("/guides/")) return "Student guide";
  if (path.startsWith("/help/")) return "Community help";
  if (path.startsWith("/notifications")) return "Notifications";
  if (path.startsWith("/profile")) return "Profile";
  if (path.startsWith("/admin/live")) return "Admin · Live users";
  if (path.startsWith("/admin")) return "Administration";
  if (path.startsWith("/settings")) return "Settings";
  if (path.startsWith("/search")) return "Search";
  return path === "/" ? "Landing page" : "Kondo";
}

const presenceUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  avatarMediaId: true,
  role: true,
  city: { select: { name: true } },
  university: { select: { name: true, shortName: true } },
  country: { select: { name: true } },
} satisfies Prisma.UserSelect;

export class DatabasePresenceStore implements PresenceStore {
  async heartbeat(input: HeartbeatInput) {
    const now = input.now ?? new Date();
    const offlineBefore = new Date(now.getTime() - PRESENCE_ONLINE_WINDOW_MS);
    const currentPath = normalizePresencePath(input.currentPath);
    const client = parseUserAgent(input.userAgent);

    await prisma.$transaction(async (tx) => {
      const previous = await tx.userPresence.findUnique({
        where: { userId: input.userId },
        select: { connectedAt: true, lastSeen: true },
      });
      const connectedAt =
        previous && previous.lastSeen >= offlineBefore
          ? previous.connectedAt
          : now;

      await tx.userPresence.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          clientSessionId: input.clientSessionId,
          connectedAt,
          lastSeen: now,
          currentPath,
          ...client,
        },
        update: {
          clientSessionId: input.clientSessionId,
          connectedAt,
          lastSeen: now,
          currentPath,
          ...client,
        },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: { lastActiveAt: now },
      });
    });
  }

  async listOnline(now: Date = new Date()) {
    const onlineAfter = new Date(now.getTime() - PRESENCE_ONLINE_WINDOW_MS);
    const presence = await prisma.userPresence.findMany({
      where: {
        lastSeen: { gte: onlineAfter },
        user: { status: "ACTIVE" },
      },
      include: { user: { select: presenceUserSelect } },
      orderBy: { lastSeen: "desc" },
    });

    return presence.map(({ user, ...entry }) => ({
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarMediaId: user.avatarMediaId,
      role: user.role,
      city: user.city?.name ?? null,
      university: user.university?.shortName ?? user.university?.name ?? null,
      country: user.country?.name ?? null,
      currentPath: entry.currentPath,
      currentPage: describePresencePath(entry.currentPath),
      connectedAt: entry.connectedAt.toISOString(),
      lastSeen: entry.lastSeen.toISOString(),
      device: entry.device,
      browser: entry.browser,
      operatingSystem: entry.operatingSystem,
    }));
  }
}

export const presenceStore: PresenceStore = new DatabasePresenceStore();
