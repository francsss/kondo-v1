import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, clearSessionCookie } from "@/lib/auth";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import {
  getSessionCredential,
  listUserSessions,
  revokeUserSessions,
} from "@/lib/settings";
import { getCurrentUser } from "@/lib/server-auth";
import { sessionBulkRevokeSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const credential = await getSessionCredential(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  );
  if (!credential || credential.userId !== user.id) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(
      {
        sessions: await listUserSessions(user.id, credential.tokenHash),
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("settings.sessions", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const credential = await getSessionCredential(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
  );
  if (!credential || credential.userId !== user.id) {
    return jsonError("Authentication required.", 401);
  }
  const parsed = sessionBulkRevokeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid session request.",
    );
  }
  try {
    const result = await revokeUserSessions(
      user.id,
      credential.tokenHash,
      parsed.data.scope,
      getRequestMeta(request),
    );
    const response = NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
    if (result.current) clearSessionCookie(request, response);
    return response;
  } catch (error) {
    return internalApiError("settings.sessions.revoke", error);
  }
}
