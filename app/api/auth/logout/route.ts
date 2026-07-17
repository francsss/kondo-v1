import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  clearSessionCookie,
  verifySessionToken,
} from "@/lib/auth";
import {
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { revokeDatabaseSession } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);

  try {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (session) {
      await revokeDatabaseSession({
        sessionId: session.sessionId,
        userId: session.id,
      });
    }

    const response = NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
    clearSessionCookie(request, response);
    return response;
  } catch (error) {
    return internalApiError("auth.logout", error);
  }
}
