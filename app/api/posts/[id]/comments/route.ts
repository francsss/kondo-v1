import { NextRequest } from "next/server";
import { CommunityError, createPostComment } from "@/lib/communities";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createCommentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`comment:${user.id}`, 60, 60 * 60_000)).allowed) {
    return jsonError("Comment limit reached.", 429);
  }
  const parsed = createCommentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid comment.");
  try {
    return Response.json(
      await createPostComment({
        actor: user,
        postId: (await params).id,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityError)
      return jsonError(error.message, error.status);
    return internalApiError("comments.create", error);
  }
}
