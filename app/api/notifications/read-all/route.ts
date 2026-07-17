import { NextRequest } from "next/server";
import { markAllNotificationsRead } from "@/lib/notifications";
import {
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    return Response.json(await markAllNotificationsRead(user.id));
  } catch (error) {
    return internalApiError("notifications.read_all", error);
  }
}
