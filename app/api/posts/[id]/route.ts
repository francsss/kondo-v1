import { NextRequest } from "next/server";
import {
  CommunityError,
  removeCommunityPost,
  updateCommunityPost,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { updatePostSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof CommunityError) return jsonError(error.message, error.status);
  return internalApiError(event, error);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = updatePostSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid post.");
  }
  try {
    return Response.json(
      await updateCommunityPost({
        actor: user,
        postId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return failure("posts.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await removeCommunityPost({
      actor: user,
      postId: (await params).id,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("posts.remove", error);
  }
}
