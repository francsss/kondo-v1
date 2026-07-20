import { NextRequest } from "next/server";
import { AuthTokenError, requestPasswordReset } from "@/lib/auth-tokens";
import { getRequestMeta, hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { requestPasswordResetSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const parsed = requestPasswordResetSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Enter a valid email.");
  }
  try {
    const result = await requestPasswordReset({
      email: parsed.data.email,
      meta: getRequestMeta(request),
    });
    // Always 200 with a generic body: existence of the account must never be
    // observable from this response.
    return Response.json({
      message: "If that email has an account, a reset link is on its way.",
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthTokenError) return jsonError(error.message, error.status);
    return internalApiError("auth.password-reset.request", error);
  }
}
