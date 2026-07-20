import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function secretMatches(
  headerValue: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !headerValue) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(headerValue);
  // timingSafeEqual throws on length mismatch; compare lengths first.
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * Authorizes an internal worker/cron request.
 *
 * Accepts an `Authorization: Bearer <secret>` header matching either:
 * - `CRON_SECRET` — the shared secret Vercel Cron sends automatically on its
 *   scheduled GET requests, used for every internal route; or
 * - the route-specific worker secret (e.g. `NOTIFICATION_WORKER_SECRET`) — used
 *   by manual POST triggers and non-Vercel schedulers.
 *
 * Returns false when no configured secret matches, so a route with no secrets
 * set at all is closed by default.
 */
export function isAuthorizedWorkerRequest(
  request: NextRequest,
  workerSecretEnv?: string,
): boolean {
  const header = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const workerSecret = workerSecretEnv
    ? process.env[workerSecretEnv]
    : undefined;
  return secretMatches(header, cronSecret) || secretMatches(header, workerSecret);
}
