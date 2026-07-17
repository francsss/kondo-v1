import { NextRequest } from "next/server";
import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  NotificationError,
  updateNotificationTemplate,
} from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin } from "@/lib/request";
import { notificationTemplateUpdateSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return adminJson({ error: "Invalid request origin." }, { status: 403 });
  }
  const auth = await authorizeAdminApi("NOTIFICATION_MANAGE");
  if (!auth.authorized) return auth.error;
  if (
    !rateLimit(
      `admin-notification-template:${auth.user.id}`,
      60,
      24 * 60 * 60_000,
    ).allowed
  ) {
    return adminJson(
      { error: "Template update limit reached. Try again later." },
      { status: 429 },
    );
  }
  const parsed = notificationTemplateUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return adminJson(
      {
        error:
          parsed.error.issues[0]?.message ?? "Invalid notification template.",
      },
      { status: 400 },
    );
  }
  try {
    const template = await updateNotificationTemplate(
      auth.user,
      {
        key: (await params).key,
        ...parsed.data,
      },
      getRequestMeta(request),
    );
    return adminJson({ template });
  } catch (error) {
    if (error instanceof NotificationError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.notifications.template", error);
  }
}
