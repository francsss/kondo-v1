import type { NextRequest } from "next/server";
import { logServerError } from "@/lib/logger";

export function getRequestMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}

export function jsonError(message: string, status = 400) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    },
  );
}

export function internalApiError(event: string, error: unknown) {
  logServerError(event, error);
  return jsonError("An unexpected server error occurred.", 500);
}

export function requestIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
}

export async function enforceMinimumDuration(
  startedAt: number,
  minimumMs: number,
) {
  const remaining = minimumMs - (Date.now() - startedAt);
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return (
      process.env.NODE_ENV !== "production" &&
      process.env.VERCEL_ENV !== "production"
    );
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  if (!host) return false;
  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const protocol = forwardedProtocol
    ? `${forwardedProtocol}:`
    : request.nextUrl.protocol;

  try {
    const parsed = new URL(origin);
    return parsed.origin === `${protocol}//${host}`;
  } catch {
    return false;
  }
}
