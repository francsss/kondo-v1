import {
  type AppLanguage,
  type NotificationDigest,
  type Prisma,
  type ThemePreference,
} from "@prisma/client";
import { verifySessionToken } from "@/lib/auth";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hashSessionId } from "@/lib/server-auth";

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type PreferenceUpdate = {
  theme?: ThemePreference;
  language?: AppLanguage;
  notificationMessages?: boolean;
  notificationComments?: boolean;
  notificationMarketplace?: boolean;
  notificationAnnouncements?: boolean;
  emailDigest?: NotificationDigest;
};

const preferenceSelect = {
  theme: true,
  language: true,
  notificationMessages: true,
  notificationComments: true,
  notificationMarketplace: true,
  notificationAnnouncements: true,
  emailDigest: true,
  updatedAt: true,
} satisfies Prisma.UserPreferenceSelect;

const defaultPreferences = {
  theme: "SYSTEM" as const,
  language: "ENGLISH" as const,
  notificationMessages: true,
  notificationComments: true,
  notificationMarketplace: true,
  notificationAnnouncements: true,
  emailDigest: "NEVER" as const,
};

export class SettingsError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "SettingsError";
  }
}

function preferenceDto(
  preference:
    | (typeof defaultPreferences & { updatedAt?: Date | null })
    | (Prisma.UserPreferenceGetPayload<{ select: typeof preferenceSelect }>),
) {
  return {
    theme: preference.theme,
    language: preference.language,
    notificationMessages: preference.notificationMessages,
    notificationComments: preference.notificationComments,
    notificationMarketplace: preference.notificationMarketplace,
    notificationAnnouncements: preference.notificationAnnouncements,
    emailDigest: preference.emailDigest,
    updatedAt: preference.updatedAt?.toISOString() ?? null,
  };
}

export async function getUserPreferences(userId: string) {
  const preference = await prisma.userPreference.findUnique({
    where: { userId },
    select: preferenceSelect,
  });
  return preferenceDto(preference ?? defaultPreferences);
}

export async function updateUserPreferences(
  userId: string,
  input: PreferenceUpdate,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const current =
      (await tx.userPreference.findUnique({
        where: { userId },
        select: preferenceSelect,
      })) ?? defaultPreferences;
    const updated = await tx.userPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
      select: preferenceSelect,
    });
    const changedFields = Object.keys(input);
    await writeAuditLogWithClient(tx, {
      actorId: userId,
      action: "USER_PREFERENCES_UPDATED",
      entityType: "UserPreference",
      entityId: userId,
      oldValue: Object.fromEntries(
        changedFields.map((field) => [
          field,
          current[field as keyof typeof current],
        ]),
      ),
      newValue: Object.fromEntries(
        changedFields.map((field) => [
          field,
          updated[field as keyof typeof updated],
        ]),
      ),
      ...meta,
    });
    return preferenceDto(updated);
  });
}

export async function getSessionCredential(token?: string | null) {
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  return {
    userId: session.id,
    tokenHash: hashSessionId(session.sessionId),
  };
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  const browser = userAgent.includes("Edg/")
    ? "Edge"
    : userAgent.includes("Chrome/")
      ? "Chrome"
      : userAgent.includes("Firefox/")
        ? "Firefox"
        : userAgent.includes("Safari/")
          ? "Safari"
          : "Browser";
  const platform = userAgent.includes("iPhone")
    ? "iPhone"
    : userAgent.includes("iPad")
      ? "iPad"
      : userAgent.includes("Android")
        ? "Android"
        : userAgent.includes("Macintosh")
          ? "Mac"
          : userAgent.includes("Windows")
            ? "Windows"
            : userAgent.includes("Linux")
              ? "Linux"
              : "device";
  return `${browser} on ${platform}`;
}

function sessionDto(
  session: {
    id: string;
    tokenHash: string;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
    expiresAt: Date;
  },
  currentTokenHash: string,
) {
  return {
    id: session.id,
    device: describeDevice(session.userAgent),
    current: session.tokenHash === currentTokenHash,
    signedInAt: session.createdAt.toISOString(),
    lastActiveAt: session.updatedAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
  };
}

export async function listUserSessions(
  userId: string,
  currentTokenHash: string,
) {
  await prisma.session.updateMany({
    where: { userId, tokenHash: currentTokenHash },
    data: { updatedAt: new Date() },
  });
  const sessions = await prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      tokenHash: true,
      userAgent: true,
      createdAt: true,
      updatedAt: true,
      expiresAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  return sessions.map((session) => sessionDto(session, currentTokenHash));
}

export async function revokeUserSession(
  userId: string,
  sessionId: string,
  currentTokenHash: string,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, tokenHash: true },
    });
    if (!session || session.userId !== userId) {
      throw new SettingsError("Session not found.", 404);
    }
    await tx.session.delete({ where: { id: session.id } });
    const current = session.tokenHash === currentTokenHash;
    await writeAuditLogWithClient(tx, {
      actorId: userId,
      action: "SESSION_REVOKED",
      entityType: "Session",
      entityId: session.id,
      newValue: { current },
      ...meta,
    });
    return { revoked: 1, current };
  });
}

export async function revokeUserSessions(
  userId: string,
  currentTokenHash: string,
  scope: "OTHERS" | "ALL",
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const where: Prisma.SessionWhereInput = {
      userId,
      ...(scope === "OTHERS"
        ? { tokenHash: { not: currentTokenHash } }
        : {}),
    };
    const sessions = await tx.session.findMany({
      where,
      select: { id: true },
    });
    const result = await tx.session.deleteMany({ where });
    await writeAuditLogWithClient(tx, {
      actorId: userId,
      action:
        scope === "ALL"
          ? "ALL_SESSIONS_REVOKED"
          : "OTHER_SESSIONS_REVOKED",
      entityType: "User",
      entityId: userId,
      newValue: {
        count: result.count,
        sessionIds: sessions.map(({ id }) => id),
      },
      ...meta,
    });
    return { revoked: result.count, current: scope === "ALL" };
  });
}
