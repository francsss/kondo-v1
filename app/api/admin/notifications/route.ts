import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  createNotificationAnnouncement,
  getNotificationDiagnostics,
  NotificationError,
} from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { notificationAnnouncementSchema } from "@/lib/validation";

export async function GET() {
  const auth = await authorizeAdminApi("NOTIFICATION_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson(await getNotificationDiagnostics(auth.user));
  } catch (error) {
    if (error instanceof NotificationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.notifications", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("NOTIFICATION_MANAGE");
  if (!auth.authorized) return auth.error;
  if (
    !rateLimit(
      `admin-notification-announcement:${auth.user.id}`,
      10,
      24 * 60 * 60_000,
    ).allowed
  ) {
    return adminJson(
      { error: "Announcement limit reached. Try again later." },
      { status: 429 },
    );
  }
  const parsed = notificationAnnouncementSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid announcement.",
      },
      { status: 400 },
    );
  }
  try {
    const announcement = await createNotificationAnnouncement(
      auth.user,
      parsed.data,
      getRequestMeta(request),
    );
    return adminJson({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof NotificationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.notifications.announce", error);
  }
}
