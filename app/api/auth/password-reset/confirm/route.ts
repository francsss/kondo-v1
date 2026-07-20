import { NextRequest } from "next/server";
import { AuthTokenError, confirmPasswordReset } from "@/lib/auth-tokens";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
  requestIp,
} from "@/lib/request";
import { confirmPasswordResetSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const parsed = confirmPasswordResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid reset request.",
    );
  }
  try {
    const limit = await rateLimit(
      `password-reset-confirm:${requestIp(request)}`,
      10,
      15 * 60_000,
    );
    if (!limit.allowed) {
      return jsonError("Too many attempts. Try again later.", 429);
    }
    await confirmPasswordReset({
      token: parsed.data.token,
      newPassword: parsed.data.password,
      meta: getRequestMeta(request),
    });
    return Response.json({ reset: true });
  } catch (error) {
    if (error instanceof AuthTokenError)
      return jsonError(error.message, error.status);
    return internalApiError("auth.password-reset.confirm", error);
  }
}
