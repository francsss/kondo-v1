import { NextRequest } from "next/server";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";
import {
  OfficialProfileError,
  submitVerificationRequest,
} from "@/lib/official-profiles";
import { verificationRequestSchema } from "@/lib/story-validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(
      await rateLimit(
        `official-profile-request:${user.id}`,
        4,
        30 * 24 * 60 * 60_000,
      )
    ).allowed
  ) {
    return jsonError("Verification request limit reached.", 429);
  }
  const parsed = verificationRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid verification request.",
    );
  }
  try {
    return Response.json(
      await submitVerificationRequest(
        user,
        parsed.data,
        getRequestMeta(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OfficialProfileError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("official-profile.submit", error);
  }
}
