import { NextRequest } from "next/server";
import { listNotifications } from "@/lib/notifications";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await listNotifications(user.id, {
        page: Number(request.nextUrl.searchParams.get("page") ?? 1),
        pageSize: Number(request.nextUrl.searchParams.get("pageSize") ?? 20),
      }),
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("notifications.list", error);
  }
}
