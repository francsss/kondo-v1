import { NextRequest, NextResponse } from "next/server";
import { presenceHeartbeatSchema, presenceStore } from "@/lib/presence";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);

  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const payload = await request.json().catch(() => null);
  const parsed = presenceHeartbeatSchema.safeParse(payload);
  if (!parsed.success) return jsonError("Invalid presence heartbeat.");

  try {
    await presenceStore.heartbeat({
      ...parsed.data,
      userId: user.id,
      userAgent: request.headers.get("user-agent"),
    });
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("presence.heartbeat", error);
  }
}
