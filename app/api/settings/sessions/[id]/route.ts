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
  revokeUserSession,
  SettingsError,
} from "@/lib/settings";
import { getCurrentUser } from "@/lib/server-auth";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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
  const { id } = await context.params;
  try {
    const result = await revokeUserSession(
      user.id,
      id,
      credential.tokenHash,
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
    if (error instanceof SettingsError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("settings.sessions.revoke_one", error);
  }
}
