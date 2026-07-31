import {
  Prisma,
  type NotificationJobStatus,
  type NotificationType,
} from "@prisma/client";
import {
  CATEGORY_PREFERENCE_FIELD,
  notificationPresentation,
} from "@/features/notifications/presentation";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { deliverPushNotificationForJob } from "@/lib/push-notifications";

export const NOTIFICATION_TEMPLATE_KEYS = [
  "MESSAGE_NEW",
  "POST_COMMENT",
  "QNA_REPLY",
  "MARKETPLACE_CONTACT",
  "MODERATION_RESULT",
  "ADMIN_ANNOUNCEMENT",
  "COMMUNITY_REQUEST_HELP",
  "COMMUNITY_REQUEST_CLOSED",
  "ACCOUNT_WELCOME",
  "ONBOARDING_REMINDER",
  "COMMUNITY_POST",
  "COMMUNITY_DAILY_SUMMARY",
  "COMMUNITY_MEMBER_SUMMARY",
  "MEET_MATCHES",
  "ACADEMIC_CLASS_REMINDER",
  "ACADEMIC_IMPORT_READY",
  "SCHOLARSHIP_MATCH",
  "MARKETPLACE_NEARBY",
  "ORGANIZATION_INVITATION",
  "ORGANIZATION_INVITATION_ACCEPTED",
  "ORGANIZATION_ROLE_CHANGED",
  "ORGANIZATION_MEMBER_REMOVED",
  "ORGANIZATION_OWNERSHIP_TRANSFER",
  "ORGANIZATION_VERIFICATION_UPDATE",
  "ORGANIZATION_STATUS_UPDATE",
  "ORGANIZATION_PUBLIC_PROFILE_STATUS",
  "ORGANIZATION_PUBLIC_PROFILE_CORRECTION",
  "HOUSING_LISTING_STATUS",
  "HOUSING_INQUIRY",
  "HOUSING_REQUEST_MATCH",
  "ROOMMATE_INTEREST",
  "ROOMMATE_INTEREST_UPDATE",
] as const;

export type NotificationTemplateKey =
  (typeof NOTIFICATION_TEMPLATE_KEYS)[number];

type NotificationActor = {
  id: string;
  role: AppRole | string;
};

export type NotificationAudience =
  | { type: "ALL" }
  | { type: "CITY"; id: string }
  | { type: "COMMUNITY"; id: string }
  | { type: "UNIVERSITY"; id: string };

type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type NotificationData = Record<
  string,
  string | number | boolean | null | undefined
>;

type EnqueueInput = {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  templateKey: NotificationTemplateKey;
  data?: NotificationData;
  href?: string | null;
  dedupeKey: string;
  announcementId?: string | null;
};

const allowedTemplateTokens: Record<
  NotificationTemplateKey,
  readonly string[]
> = {
  MESSAGE_NEW: ["actorName", "preview"],
  POST_COMMENT: ["actorName", "preview"],
  QNA_REPLY: ["actorName", "preview"],
  MARKETPLACE_CONTACT: ["actorName", "listingTitle"],
  MODERATION_RESULT: ["outcome"],
  ADMIN_ANNOUNCEMENT: ["title", "body"],
  COMMUNITY_REQUEST_HELP: ["actorName", "requestTitle"],
  COMMUNITY_REQUEST_CLOSED: ["requestTitle"],
  ACCOUNT_WELCOME: ["firstName"],
  ONBOARDING_REMINDER: [],
  COMMUNITY_POST: ["actorName", "communityName", "preview"],
  COMMUNITY_DAILY_SUMMARY: ["communityName", "count"],
  COMMUNITY_MEMBER_SUMMARY: ["communityName", "count"],
  MEET_MATCHES: ["areaName", "count", "intention"],
  ACADEMIC_CLASS_REMINDER: ["courseName", "minutes", "location"],
  ACADEMIC_IMPORT_READY: ["courseCount"],
  SCHOLARSHIP_MATCH: ["scholarshipTitle"],
  MARKETPLACE_NEARBY: ["listingTitle", "cityName"],
  ORGANIZATION_INVITATION: ["organizationName", "role"],
  ORGANIZATION_INVITATION_ACCEPTED: ["actorName", "organizationName"],
  ORGANIZATION_ROLE_CHANGED: ["organizationName", "role"],
  ORGANIZATION_MEMBER_REMOVED: ["organizationName"],
  ORGANIZATION_OWNERSHIP_TRANSFER: ["organizationName", "outcome"],
  ORGANIZATION_VERIFICATION_UPDATE: ["organizationName", "outcome"],
  ORGANIZATION_STATUS_UPDATE: ["organizationName", "outcome"],
  ORGANIZATION_PUBLIC_PROFILE_STATUS: ["organizationName", "outcome"],
  ORGANIZATION_PUBLIC_PROFILE_CORRECTION: ["organizationName", "outcome"],
  HOUSING_LISTING_STATUS: ["listingTitle", "outcome"],
  HOUSING_INQUIRY: ["actorName", "listingTitle"],
  HOUSING_REQUEST_MATCH: ["cityName"],
  ROOMMATE_INTEREST: ["actorName"],
  ROOMMATE_INTEREST_UPDATE: ["actorName", "outcome"],
};

const safeRoutePrefixes = [
  "/messages",
  "/communities",
  "/marketplace",
  "/housing",
  "/help",
  "/guides",
  "/profile",
  "/notifications",
  "/student-hub",
  "/settings",
  "/explore",
  "/stories",
  "/home",
  "/language",
  "/onboarding",
  "/search",
  "/organizations",
  "/organization-invitations",
] as const;

export class NotificationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}

function clampPage(value?: number) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value ?? 1)) : 1;
}

function clampPageSize(value?: number) {
  return Number.isFinite(value)
    ? Math.min(50, Math.max(1, Math.floor(value ?? 20)))
    : 20;
}

export function safeNotificationHref(value?: string | null) {
  if (!value) return null;
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new NotificationError("Notification link is not allowed.");
  }
  const parsed = new URL(value, "https://kondo.invalid");
  if (
    parsed.origin !== "https://kondo.invalid" ||
    (parsed.pathname !== "/" &&
      !safeRoutePrefixes.some(
        (prefix) =>
          parsed.pathname === prefix ||
          parsed.pathname.startsWith(`${prefix}/`),
      ))
  ) {
    throw new NotificationError("Notification link is not allowed.");
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function safeStoredHref(value?: string | null) {
  try {
    return safeNotificationHref(value);
  } catch {
    return null;
  }
}

function toJsonData(data: NotificationData = {}) {
  return Object.fromEntries(
    Object.entries(data).filter((entry) => entry[1] !== undefined),
  ) as Prisma.InputJsonObject;
}

export async function enqueueNotificationJobWithClient(
  client: Prisma.TransactionClient,
  input: EnqueueInput,
) {
  if (input.actorId && input.actorId === input.recipientId) return null;
  const href = safeNotificationHref(input.href);
  await client.notificationJob.createMany({
    data: [
      {
        recipientId: input.recipientId,
        actorId: input.actorId ?? null,
        type: input.type,
        templateKey: input.templateKey,
        data: toJsonData(input.data),
        href,
        dedupeKey: input.dedupeKey,
        announcementId: input.announcementId ?? null,
      },
    ],
    skipDuplicates: true,
  });
  return client.notificationJob.findUniqueOrThrow({
    where: {
      recipientId_dedupeKey: {
        recipientId: input.recipientId,
        dedupeKey: input.dedupeKey,
      },
    },
    select: { id: true, status: true },
  });
}

export async function enqueueNotificationJob(input: EnqueueInput) {
  return prisma.$transaction((tx) =>
    enqueueNotificationJobWithClient(tx, input),
  );
}

export function enqueuePostCommentNotification(
  client: Prisma.TransactionClient,
  input: {
    recipientId: string;
    actorId: string;
    actorName: string;
    commentId: string;
    preview: string;
    postHref: string;
  },
) {
  return enqueueNotificationJobWithClient(client, {
    recipientId: input.recipientId,
    actorId: input.actorId,
    type: "COMMENT",
    templateKey: "POST_COMMENT",
    data: {
      actorName: input.actorName,
      preview: input.preview.slice(0, 280),
    },
    href: input.postHref,
    dedupeKey: `comment:${input.commentId}`,
  });
}

type NotificationPreferences = {
  notificationMessages: boolean;
  notificationComments: boolean;
  notificationMarketplace: boolean;
  notificationHousing: boolean;
  notificationAnnouncements: boolean;
  notificationCommunity: boolean;
  notificationMeet: boolean;
  notificationAcademic: boolean;
  notificationRecommendations: boolean;
  notificationFriends: boolean;
  notificationEvents: boolean;
  notificationTransfers: boolean;
  notificationUniversity: boolean;
};

/**
 * The category toggles in Settings are keyed off the presentation layer, not off
 * NotificationType, because that is the grouping the recipient actually sees on
 * the notification itself. Gating here keeps the label and the delivery rule in
 * sync for kinds whose type is broader than their category — a scholarship match
 * is typed RECOMMENDATION but presents as University.
 */
function categoryPreferenceAllows(
  type: NotificationType,
  templateKey: string | null,
  preference: NotificationPreferences,
) {
  const { category } = notificationPresentation({ type, templateKey });
  const field = CATEGORY_PREFERENCE_FIELD[category];
  return field === null ? true : preference[field];
}

function preferenceAllows(
  type: NotificationType,
  templateKey: string | null,
  preference: NotificationPreferences | null,
) {
  if (type === "MODERATION_UPDATE" || type === "ACCOUNT") return true;
  if (!preference) return true;
  if (!categoryPreferenceAllows(type, templateKey, preference)) return false;
  if (type === "MESSAGE") return preference.notificationMessages;
  if (type === "COMMENT" || type === "REPLY") {
    return preference.notificationComments;
  }
  if (type === "MARKETPLACE_UPDATE") {
    return preference.notificationMarketplace;
  }
  if (type === "HOUSING") return preference.notificationHousing;
  if (type === "COMMUNITY_ACTIVITY") {
    return preference.notificationCommunity;
  }
  if (type === "MEET_ACTIVITY") return preference.notificationMeet;
  if (type === "ACADEMIC") return preference.notificationAcademic;
  if (type === "RECOMMENDATION") {
    return preference.notificationRecommendations;
  }
  return preference.notificationAnnouncements;
}

function notificationData(value: Prisma.JsonValue | null) {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item ?? "")]),
  );
}

function renderTemplate(template: string, data: Record<string, string>) {
  return template
    .replace(/\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g, (_, token: string) => {
      return data[token] ?? "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function validateTemplateTokens(
  key: NotificationTemplateKey,
  titleTemplate: string,
  bodyTemplate: string | null,
) {
  const allowed = new Set(allowedTemplateTokens[key]);
  const tokens = `${titleTemplate} ${bodyTemplate ?? ""}`.matchAll(
    /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g,
  );
  for (const match of tokens) {
    if (!allowed.has(match[1])) {
      throw new NotificationError(
        `Template token {{${match[1]}}} is not allowed for ${key}.`,
      );
    }
  }
}

async function completeAnnouncementIfFinished(announcementId: string) {
  const remaining = await prisma.notificationJob.count({
    where: {
      announcementId,
      status: { in: ["PENDING", "PROCESSING"] },
    },
  });
  if (!remaining) {
    await prisma.notificationAnnouncement.updateMany({
      where: { id: announcementId, status: "QUEUED" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
}

async function deliverClaimedJob(jobId: string) {
  return prisma.$transaction(async (tx) => {
    const job = await tx.notificationJob.findUnique({
      where: { id: jobId },
      include: {
        template: true,
        recipient: {
          select: {
            status: true,
            preference: {
              select: {
                notificationMessages: true,
                notificationComments: true,
                notificationMarketplace: true,
                notificationHousing: true,
                notificationAnnouncements: true,
                notificationCommunity: true,
                notificationMeet: true,
                notificationAcademic: true,
                notificationRecommendations: true,
                notificationFriends: true,
                notificationEvents: true,
                notificationTransfers: true,
                notificationUniversity: true,
              },
            },
          },
        },
      },
    });
    if (!job || job.status !== "PROCESSING") return "SKIPPED" as const;
    const skipCode =
      job.recipient.status !== "ACTIVE"
        ? "RECIPIENT_INACTIVE"
        : !job.template.isActive
          ? "TEMPLATE_INACTIVE"
          : !preferenceAllows(
                job.type,
                job.templateKey,
                job.recipient.preference,
              )
            ? "PREFERENCE_DISABLED"
            : null;
    if (skipCode) {
      await tx.notificationJob.update({
        where: { id: job.id },
        data: {
          status: "SKIPPED",
          completedAt: new Date(),
          lockedAt: null,
          lastErrorCode: skipCode,
        },
      });
      return "SKIPPED" as const;
    }
    const data = notificationData(job.data);
    const title = renderTemplate(job.template.titleTemplate, data).slice(
      0,
      160,
    );
    const body = job.template.bodyTemplate
      ? renderTemplate(job.template.bodyTemplate, data).slice(0, 280)
      : null;
    if (!title) {
      throw new NotificationError("Notification template rendered empty.");
    }
    await tx.notification.upsert({
      where: {
        recipientId_dedupeKey: {
          recipientId: job.recipientId,
          dedupeKey: job.dedupeKey,
        },
      },
      create: {
        recipientId: job.recipientId,
        actorId: job.actorId,
        type: job.type,
        title,
        body,
        href: safeNotificationHref(job.href),
        templateKey: job.templateKey,
        dedupeKey: job.dedupeKey,
        data: job.data ?? undefined,
        jobId: job.id,
      },
      update: {},
    });
    await tx.notificationJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lockedAt: null,
        lastErrorCode: null,
      },
    });
    return "COMPLETED" as const;
  });
}

export async function processNotificationJobNow(jobId: string) {
  const claimed = await prisma.notificationJob.updateMany({
    where: {
      id: jobId,
      status: "PENDING",
      availableAt: { lte: new Date() },
      attempts: { lt: 3 },
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: new Date(),
    },
  });
  if (!claimed.count) {
    const current = await prisma.notificationJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    return current?.status ?? "SKIPPED";
  }

  const job = await prisma.notificationJob.findUniqueOrThrow({
    where: { id: jobId },
    select: { attempts: true, announcementId: true },
  });
  try {
    const result = await deliverClaimedJob(jobId);
    if (result === "COMPLETED") {
      await deliverPushNotificationForJob(jobId).catch(() => null);
    }
    if (job.announcementId) {
      await completeAnnouncementIfFinished(job.announcementId);
    }
    return result;
  } catch {
    const terminal = job.attempts >= 3;
    await prisma.notificationJob.updateMany({
      where: { id: jobId, status: "PROCESSING" },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        availableAt: new Date(Date.now() + job.attempts * 60_000),
        lockedAt: null,
        lastErrorCode: "PROCESSING_ERROR",
      },
    });
    return terminal ? "FAILED" : "PENDING";
  }
}

export async function processNotificationJobs(limit = 100) {
  const take = Math.min(500, Math.max(1, Math.floor(limit)));
  await prisma.notificationJob.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(Date.now() - 10 * 60_000) },
    },
    data: {
      status: "PENDING",
      availableAt: new Date(),
      lockedAt: null,
      lastErrorCode: "WORKER_TIMEOUT",
    },
  });
  const candidates = await prisma.notificationJob.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: new Date() },
      attempts: { lt: 3 },
    },
    select: { id: true, attempts: true, announcementId: true },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take,
  });
  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    const result = await prisma.notificationJob.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        attempts: { increment: 1 },
        lockedAt: new Date(),
      },
    });
    if (result.count === 1) claimed.push(candidate);
  }

  let completed = 0;
  let skipped = 0;
  let failed = 0;
  const completedJobIds: string[] = [];
  const announcementIds = new Set<string>();
  for (const job of claimed) {
    if (job.announcementId) announcementIds.add(job.announcementId);
    try {
      const result = await deliverClaimedJob(job.id);
      if (result === "COMPLETED") {
        completed += 1;
        completedJobIds.push(job.id);
      } else skipped += 1;
    } catch {
      const attempts = job.attempts + 1;
      const terminal = attempts >= 3;
      await prisma.notificationJob.updateMany({
        where: { id: job.id, status: "PROCESSING" },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          availableAt: new Date(Date.now() + attempts * 60_000),
          lockedAt: null,
          lastErrorCode: "PROCESSING_ERROR",
        },
      });
      failed += 1;
    }
  }
  for (const announcementId of announcementIds) {
    await completeAnnouncementIfFinished(announcementId);
  }
  await Promise.allSettled(
    completedJobIds.map((jobId) => deliverPushNotificationForJob(jobId)),
  );
  return {
    claimed: claimed.length,
    completed,
    skipped,
    failed,
  };
}

function notificationDto(notification: {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  templateKey: string | null;
  readAt: Date | null;
  createdAt: Date;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    avatarMediaId: string | null;
  } | null;
}) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: safeStoredHref(notification.href),
    templateKey: notification.templateKey,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    actor: notification.actor,
  };
}

export async function listNotifications(
  userId: string,
  filters: { page?: number; pageSize?: number } = {},
) {
  const page = clampPage(filters.page);
  const pageSize = clampPageSize(filters.pageSize);
  const where: Prisma.NotificationWhereInput = {
    recipientId: userId,
    hiddenAt: null,
  };
  const [total, unreadCount, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
    prisma.notification.findMany({
      where,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        href: true,
        templateKey: true,
        readAt: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarMediaId: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
    unreadCount,
    notifications: notifications.map(notificationDto),
  };
}

export function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { recipientId: userId, readAt: null, hiddenAt: null },
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, recipientId: userId, hiddenAt: null },
    data: { readAt: new Date() },
  });
  if (result.count !== 1) {
    throw new NotificationError("Notification not found.", 404);
  }
  return { read: true };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, hiddenAt: null, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export async function hideNotification(userId: string, id: string) {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: { id, recipientId: userId, hiddenAt: null },
    data: { hiddenAt: now, readAt: now },
  });
  if (result.count !== 1) {
    throw new NotificationError("Notification not found.", 404);
  }
  return { hidden: true };
}

export async function listNotificationTemplates(actor: NotificationActor) {
  if (!hasAdminPermission(actor.role, "NOTIFICATION_VIEW")) {
    throw new NotificationError("Access denied.", 403);
  }
  const templates = await prisma.notificationTemplate.findMany({
    select: {
      key: true,
      type: true,
      titleTemplate: true,
      bodyTemplate: true,
      isActive: true,
      version: true,
      updatedAt: true,
      updatedBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: { key: "asc" },
  });
  return templates.map((template) => ({
    ...template,
    allowedTokens:
      allowedTemplateTokens[template.key as NotificationTemplateKey] ?? [],
    updatedAt: template.updatedAt.toISOString(),
  }));
}

export async function updateNotificationTemplate(
  actor: NotificationActor,
  input: {
    key: string;
    titleTemplate: string;
    bodyTemplate: string | null;
    isActive: boolean;
    expectedVersion: number;
  },
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "NOTIFICATION_MANAGE")) {
    throw new NotificationError("Access denied.", 403);
  }
  if (
    !NOTIFICATION_TEMPLATE_KEYS.includes(input.key as NotificationTemplateKey)
  ) {
    throw new NotificationError("Notification template not found.", 404);
  }
  const key = input.key as NotificationTemplateKey;
  if (key === "MODERATION_RESULT" && !input.isActive) {
    throw new NotificationError(
      "Safety-result notifications cannot be disabled.",
    );
  }
  validateTemplateTokens(key, input.titleTemplate, input.bodyTemplate);
  return prisma.$transaction(async (tx) => {
    const current = await tx.notificationTemplate.findUnique({
      where: { key },
    });
    if (!current) {
      throw new NotificationError("Notification template not found.", 404);
    }
    const result = await tx.notificationTemplate.updateMany({
      where: { key, version: input.expectedVersion },
      data: {
        titleTemplate: input.titleTemplate,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new NotificationError(
        "Notification template changed. Refresh and try again.",
        409,
      );
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "NOTIFICATION_TEMPLATE_UPDATED",
      entityType: "NotificationTemplate",
      entityId: key,
      oldValue: {
        titleTemplate: current.titleTemplate,
        bodyTemplate: current.bodyTemplate,
        isActive: current.isActive,
        version: current.version,
      },
      newValue: {
        titleTemplate: input.titleTemplate,
        bodyTemplate: input.bodyTemplate,
        isActive: input.isActive,
        version: current.version + 1,
      },
      ...meta,
    });
    return {
      key,
      version: current.version + 1,
      isActive: input.isActive,
    };
  });
}

export async function createNotificationAnnouncement(
  actor: NotificationActor,
  input: {
    title: string;
    body: string;
    href?: string | null;
    audience?: NotificationAudience;
  },
  meta: RequestMeta = {},
) {
  if (!hasAdminPermission(actor.role, "NOTIFICATION_MANAGE")) {
    throw new NotificationError("Access denied.", 403);
  }
  const href = safeNotificationHref(input.href);
  return prisma.$transaction(async (tx) => {
    const requestedAudience = input.audience ?? { type: "ALL" as const };
    let audience: Prisma.InputJsonObject = { type: "ALL", label: "All users" };
    const recipientWhere: Prisma.UserWhereInput = { status: "ACTIVE" };
    if (requestedAudience.type === "CITY") {
      const city = await tx.city.findUnique({
        where: { id: requestedAudience.id },
        select: { id: true, name: true, isActive: true },
      });
      if (!city?.isActive) throw new NotificationError("City not found.", 404);
      recipientWhere.cityId = city.id;
      audience = { type: "CITY", id: city.id, label: city.name };
    } else if (requestedAudience.type === "UNIVERSITY") {
      const university = await tx.university.findUnique({
        where: { id: requestedAudience.id },
        select: { id: true, name: true, isActive: true },
      });
      if (!university?.isActive) {
        throw new NotificationError("University not found.", 404);
      }
      recipientWhere.universityId = university.id;
      audience = {
        type: "UNIVERSITY",
        id: university.id,
        label: university.name,
      };
    } else if (requestedAudience.type === "COMMUNITY") {
      const community = await tx.community.findUnique({
        where: { id: requestedAudience.id },
        select: { id: true, name: true, status: true },
      });
      if (!community || community.status === "REMOVED") {
        throw new NotificationError("Community not found.", 404);
      }
      recipientWhere.communityMemberships = {
        some: { communityId: community.id },
      };
      audience = {
        type: "COMMUNITY",
        id: community.id,
        label: community.name,
      };
    }
    const recipients = await tx.user.findMany({
      where: recipientWhere,
      select: { id: true },
    });
    const announcement = await tx.notificationAnnouncement.create({
      data: {
        title: input.title,
        body: input.body,
        href,
        audience,
        createdById: actor.id,
        recipientCount: recipients.length,
      },
      select: { id: true, status: true, queuedAt: true },
    });
    if (recipients.length) {
      await tx.notificationJob.createMany({
        data: recipients.map(({ id }) => ({
          recipientId: id,
          type: "COMMUNITY_ANNOUNCEMENT" as const,
          templateKey: "ADMIN_ANNOUNCEMENT",
          data: { title: input.title, body: input.body },
          href,
          dedupeKey: `announcement:${announcement.id}`,
          announcementId: announcement.id,
        })),
      });
    } else {
      await tx.notificationAnnouncement.update({
        where: { id: announcement.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "NOTIFICATION_ANNOUNCEMENT_QUEUED",
      entityType: "NotificationAnnouncement",
      entityId: announcement.id,
      newValue: {
        recipientCount: recipients.length,
        href,
        audience,
      },
      ...meta,
    });
    return {
      id: announcement.id,
      status: recipients.length ? announcement.status : "COMPLETED",
      recipientCount: recipients.length,
      queuedAt: announcement.queuedAt.toISOString(),
    };
  });
}

export async function listNotificationAudienceOptions(
  actor: NotificationActor,
) {
  if (!hasAdminPermission(actor.role, "NOTIFICATION_VIEW")) {
    throw new NotificationError("Access denied.", 403);
  }
  const [cities, communities, universities] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.community.findMany({
      where: { status: { not: "REMOVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);
  return { cities, communities, universities };
}

export async function getNotificationDiagnostics(actor: NotificationActor) {
  if (!hasAdminPermission(actor.role, "NOTIFICATION_VIEW")) {
    throw new NotificationError("Access denied.", 403);
  }
  const [
    pending,
    processing,
    failed,
    skipped,
    delivered,
    templates,
    announcements,
    recentJobs,
  ] = await Promise.all([
    prisma.notificationJob.count({ where: { status: "PENDING" } }),
    prisma.notificationJob.count({ where: { status: "PROCESSING" } }),
    prisma.notificationJob.count({ where: { status: "FAILED" } }),
    prisma.notificationJob.count({ where: { status: "SKIPPED" } }),
    prisma.notificationJob.count({ where: { status: "COMPLETED" } }),
    listNotificationTemplates(actor),
    prisma.notificationAnnouncement.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        recipientCount: true,
        audience: true,
        queuedAt: true,
        completedAt: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { queuedAt: "desc" },
      take: 10,
    }),
    prisma.notificationJob.findMany({
      select: {
        id: true,
        type: true,
        templateKey: true,
        status: true,
        attempts: true,
        lastErrorCode: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return {
    counts: { pending, processing, failed, skipped, delivered },
    templates,
    announcements: announcements.map((announcement) => ({
      ...announcement,
      queuedAt: announcement.queuedAt.toISOString(),
      completedAt: announcement.completedAt?.toISOString() ?? null,
    })),
    recentJobs: recentJobs.map((job) => ({
      ...job,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    })),
  };
}

export function isTerminalNotificationJob(status: NotificationJobStatus) {
  return ["COMPLETED", "SKIPPED", "FAILED"].includes(status);
}
