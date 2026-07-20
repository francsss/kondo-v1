import { NextRequest } from "next/server";
import {
  CommunityError,
  removePostComment,
  updatePostComment,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { updateCommentSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof CommunityError)
    return jsonError(error.message, error.status);
  return internalApiError(event, error);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = updateCommentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid comment.");
  try {
    return Response.json(
      await updatePostComment({
        actor: user,
        commentId: (await params).id,
        content: parsed.data.content,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return failure("comments.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await removePostComment({
      actor: user,
      commentId: (await params).id,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("comments.remove", error);
  }
}
