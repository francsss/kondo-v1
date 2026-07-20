import { NextRequest } from "next/server";
import { AuthTokenError, requestEmailVerification } from "@/lib/auth-tokens";
import { getRequestMeta, hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const result = await requestEmailVerification({
      userId: user.id,
      meta: getRequestMeta(request),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof AuthTokenError) return jsonError(error.message, error.status);
    return internalApiError("auth.verify-email.request", error);
  }
}
