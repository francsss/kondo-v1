import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLogWithClient } from "@/lib/audit";
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
import { createDatabaseSession } from "@/lib/server-auth";
import { registerSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const limit = await rateLimit(
    `register:${requestIp(request)}`,
    5,
    60 * 60_000,
  );
  if (!limit.allowed)
    return jsonError("Too many accounts created. Try again later.", 429);

  const payload = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(payload);

  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Please check your details.",
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const meta = getRequestMeta(request);
  try {
    const { user, sessionId } = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: parsed.data.email,
          passwordHash,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          role: "MEMBER",
        },
      });
      const createdSessionId = await createDatabaseSession(
        {
          userId: createdUser.id,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
        tx,
      );
      await writeAuditLogWithClient(tx, {
        actorId: createdUser.id,
        action: "USER_REGISTERED",
        entityType: "User",
        entityId: createdUser.id,
        newValue: { role: createdUser.role },
        ...meta,
      });
      return { user: createdUser, sessionId: createdSessionId };
    });
    await trackEvent({ name: "USER_REGISTERED", userId: user.id, sessionId });

    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    });
    const response = NextResponse.json(
      { user: toSafeUser(user) },
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
    setSessionCookie(request, response, token);
    return response;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError("An account with that email already exists.", 409);
    }
    return internalApiError("auth.register", error);
  }
}
