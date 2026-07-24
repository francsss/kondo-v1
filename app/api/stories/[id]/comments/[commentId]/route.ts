import { NextRequest } from "next/server";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { deleteStoryComment, StoryError } from "@/lib/stories";

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; commentId: string }>;
  },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id, commentId } = await params;
  try {
    return Response.json(await deleteStoryComment(user, id, commentId));
  } catch (error) {
    if (error instanceof StoryError)
      return jsonError(error.message, error.status);
    return internalApiError("stories.comments.delete", error);
  }
}
