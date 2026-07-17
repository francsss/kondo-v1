import { NextRequest } from "next/server";
import {
  CommunityError,
  createCommunityPost,
} from "@/lib/communities";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createPostSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`post:${user.id}`, 12, 60 * 60_000).allowed) {
    return jsonError("Posting limit reached. Try again later.", 429);
  }
  const parsed = createPostSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid post.");
  }
  try {
    return Response.json(
      await createCommunityPost({
        actor: user,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("posts.create", error);
  }
}
