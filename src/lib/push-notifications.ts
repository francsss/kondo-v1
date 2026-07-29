import webPush, {
  type PushSubscription as WebPushSubscription,
} from "web-push";
import { notificationPresentation } from "@/features/notifications/presentation";
import { logServerError, logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type BrowserSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

function pushConfiguration() {
  const publicKey =
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() ?? "";
  if (!publicKey || !privateKey || !subject) return null;
  return { privateKey, publicKey, subject };
}

export function webPushIsConfigured() {
  return Boolean(pushConfiguration());
}

export async function savePushSubscription(
  userId: string,
  subscription: BrowserSubscriptionInput,
  userAgent?: string | null,
) {
  const expiresAt =
    subscription.expirationTime && Number.isFinite(subscription.expirationTime)
      ? new Date(subscription.expirationTime)
      : null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expiresAt,
      userAgent: userAgent?.slice(0, 320) || null,
    },
    update: {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      expiresAt,
      userAgent: userAgent?.slice(0, 320) || null,
      disabledAt: null,
      failureCount: 0,
    },
  });
  return { enabled: true };
}

export async function removePushSubscription(
  userId: string,
  endpoint?: string | null,
) {
  const result = await prisma.pushSubscription.updateMany({
    where: {
      userId,
      disabledAt: null,
      ...(endpoint ? { endpoint } : {}),
    },
    data: { disabledAt: new Date() },
  });
  return { enabled: false, updated: result.count };
}

export async function getPushSubscriptionStatus(userId: string) {
  return {
    configured: webPushIsConfigured(),
    enabled:
      (await prisma.pushSubscription.count({
        where: {
          userId,
          disabledAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      })) > 0,
  };
}

function webPushErrorStatus(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) {
    return null;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

export async function deliverPushNotificationForJob(jobId: string) {
  const configuration = pushConfiguration();
  if (!configuration) return { attempted: 0, delivered: 0, disabled: 0 };

  const notification = await prisma.notification.findUnique({
    where: { jobId },
    select: {
      id: true,
      recipientId: true,
      type: true,
      templateKey: true,
      title: true,
      body: true,
      href: true,
      createdAt: true,
      recipient: {
        select: {
          preference: {
            select: {
              notificationSounds: true,
              notificationHaptics: true,
            },
          },
        },
      },
    },
  });
  if (!notification) return { attempted: 0, delivered: 0, disabled: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      userId: notification.recipientId,
      disabledAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
    take: 10,
  });
  if (!subscriptions.length) {
    return { attempted: 0, delivered: 0, disabled: 0 };
  }

  const presentation = notificationPresentation(notification);
  const payload = JSON.stringify({
    id: notification.id,
    type: notification.type,
    templateKey: notification.templateKey,
    kind: presentation.kind,
    title: notification.title,
    body: notification.body,
    href: notification.href ?? "/notifications",
    category: presentation.category,
    actionLabel: presentation.actionLabel,
    createdAt: notification.createdAt.toISOString(),
    feedback: {
      sound: notification.recipient.preference?.notificationSounds ?? false,
      haptics: notification.recipient.preference?.notificationHaptics ?? true,
    },
  });
  let delivered = 0;
  let disabled = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      const webSubscription: WebPushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth,
          p256dh: subscription.p256dh,
        },
      };
      try {
        await webPush.sendNotification(webSubscription, payload, {
          TTL: 6 * 60 * 60,
          urgency: presentation.category === "security" ? "high" : "normal",
          topic: notification.id.slice(-32),
          timeout: 8_000,
          vapidDetails: {
            subject: configuration.subject,
            publicKey: configuration.publicKey,
            privateKey: configuration.privateKey,
          },
        });
        delivered += 1;
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastDeliveredAt: new Date(),
            failureCount: 0,
          },
        });
      } catch (error) {
        const status = webPushErrorStatus(error);
        const expired = status === 404 || status === 410;
        if (expired) disabled += 1;
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: expired
            ? { disabledAt: new Date(), failureCount: { increment: 1 } }
            : { failureCount: { increment: 1 } },
        });
        logServerError("notification.push.failed", error, {
          expired,
          status,
        });
      }
    }),
  );
  logServerEvent("notification.push.completed", {
    attempted: subscriptions.length,
    delivered,
    disabled,
  });
  return { attempted: subscriptions.length, delivered, disabled };
}
