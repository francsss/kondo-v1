import { NextRequest } from "next/server";
import { createMediaUploadIntent, MediaError } from "@/lib/media";
import { MediaPolicyError } from "@/lib/media-policy";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { mediaUploadIntentSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`media-upload:${user.id}`, 30, 24 * 60 * 60_000)).allowed
  ) {
    return jsonError("Media upload limit reached. Try again later.", 429);
  }
  const parsed = mediaUploadIntentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid media upload.",
    );
  }

  try {
    return Response.json(
      await createMediaUploadIntent(user, parsed.data, getRequestMeta(request)),
      {
        status: 201,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    if (error instanceof MediaError || error instanceof MediaPolicyError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.upload.authorize", error);
  }
}
