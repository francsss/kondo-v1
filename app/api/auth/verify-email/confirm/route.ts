import { NextRequest } from "next/server";
import { AuthTokenError, confirmEmailVerification } from "@/lib/auth-tokens";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
  requestIp,
} from "@/lib/request";
import { confirmEmailVerificationSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const parsed = confirmEmailVerificationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid verification link.",
    );
  }
  try {
    const limit = await rateLimit(
      `verify-email-confirm:${requestIp(request)}`,
      30,
      15 * 60_000,
    );
    if (!limit.allowed) {
      return jsonError("Too many attempts. Try again later.", 429);
    }
    const result = await confirmEmailVerification({
      token: parsed.data.token,
      meta: getRequestMeta(request),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthTokenError)
      return jsonError(error.message, error.status);
    return internalApiError("auth.verify-email.confirm", error);
  }
}
