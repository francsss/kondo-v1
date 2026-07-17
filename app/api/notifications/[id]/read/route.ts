import { NextRequest } from "next/server";
import {
  markNotificationRead,
  NotificationError,
} from "@/lib/notifications";
import {
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await markNotificationRead(user.id, (await params).id),
    );
  } catch (error) {
    if (error instanceof NotificationError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("notifications.read", error);
  }
}
