import { NextRequest } from "next/server";
import { completeMediaUpload, MediaError } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`media-complete:${user.id}`, 60, 60_000).allowed) {
    return jsonError("Too many media requests. Try again shortly.", 429);
  }

  try {
    const media = await completeMediaUpload(
      user,
      (await params).id,
      getRequestMeta(request),
    );
    return Response.json(
      { media },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    if (error instanceof MediaError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("media.upload.complete", error);
  }
}
