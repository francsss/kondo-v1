import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLog, writeAuditLogWithClient } from "@/lib/audit";
import { logServerError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
  requestIp,
} from "@/lib/request";
import { toSafeUser } from "@/lib/serializers";
import {
  createDatabaseSession,
  hashSecurityIdentifier,
} from "@/lib/server-auth";
import { loginSchema } from "@/lib/validation";

// A valid cost-12 bcrypt hash used only to keep unknown-account login attempts
// on the same expensive comparison path as known accounts.
const DUMMY_PASSWORD_HASH =
  "$2a$12$kkhthC9rXqBLSoLcXKra3.nUOqRDIap0tp6AYLzn0r8trmQNgzDjW";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const limit = await rateLimit(`login:${requestIp(request)}`, 8, 10 * 60_000);
  if (!limit.allowed)
    return jsonError("Too many attempts. Try again later.", 429);

  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonError("Email or password is incorrect.", 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    const passwordOk = await bcrypt.compare(
      parsed.data.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordOk || user.status !== "ACTIVE") {
      try {
        await writeAuditLog({
          action: "LOGIN_FAILED",
          entityType: "Credential",
          entityId: hashSecurityIdentifier(parsed.data.email),
          ...getRequestMeta(request),
        });
      } catch (error) {
        logServerError("auth.login_failed_audit", error);
      }
      return jsonError("Email or password is incorrect.", 401);
    }

    const meta = getRequestMeta(request);
    const sessionId = await prisma.$transaction(async (tx) => {
      const createdSessionId = await createDatabaseSession(
        {
          userId: user.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await writeAuditLogWithClient(tx, {
        actorId: user.id,
        action: "LOGIN_SUCCESS",
        entityType: "User",
        entityId: user.id,
        ...meta,
      });
      return createdSessionId;
    });
    await trackEvent({ name: "USER_LOGGED_IN", userId: user.id, sessionId });

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });
    const response = NextResponse.json(
      { user: toSafeUser(user) },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
    setSessionCookie(request, response, token);
    return response;
  } catch (error) {
    return internalApiError("auth.login", error);
  }
}
