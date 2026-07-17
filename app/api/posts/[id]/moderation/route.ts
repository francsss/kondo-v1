import { NextRequest } from "next/server";
import {
  CommunityError,
  moderateCommunityPost,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { postModerationSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = postModerationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid moderation action.");
  try {
    return Response.json(
      await moderateCommunityPost({
        actor: user,
        postId: (await params).id,
        action: parsed.data.action,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CommunityError) return jsonError(error.message, error.status);
    return internalApiError("posts.moderate", error);
  }
}
