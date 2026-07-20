import { SignJWT, jwtVerify } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import type { AppRole } from "@/lib/authorization";
import { getJwtSecret } from "@/lib/runtime-secrets";

export const AUTH_COOKIE_NAME = "kondo_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  email: string;
  role: AppRole;
  sessionId: string;
};

function secretKey() {
  return new TextEncoder().encode(getJwtSecret());
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: user.sessionId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.sessionId !== "string"
    ) {
      return null;
    }

    return {
      id: payload.userId,
      email: payload.email,
      role: payload.role as AppRole,
      sessionId: payload.sessionId,
    };
  } catch {
    return null;
  }
}

export function isSecureRequest(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return false;

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) return forwardedProtocol === "https";
  return request.nextUrl.protocol === "https:";
}

function sessionCookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecureRequest(request),
    path: "/",
  };
}

export function setSessionCookie(
  request: NextRequest,
  response: NextResponse,
  token: string,
) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    ...sessionCookieOptions(request),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(
  request: NextRequest,
  response: NextResponse,
) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...sessionCookieOptions(request),
    expires: new Date(0),
    maxAge: 0,
  });
}
