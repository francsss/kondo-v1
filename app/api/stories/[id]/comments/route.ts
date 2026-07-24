import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { addStoryComment, listStoryComments, StoryError } from "@/lib/stories";
import { storyCommentSchema } from "@/lib/story-validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(await listStoryComments(user, (await params).id));
  } catch (error) {
    if (error instanceof StoryError)
      return jsonError(error.message, error.status);
    return internalApiError("stories.comments.list", error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`story-comment:${user.id}`, 20, 60_000)).allowed) {
    return jsonError("Comment limit reached. Try again shortly.", 429);
  }
  const parsed = storyCommentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid comment.");
  }
  try {
    return Response.json(
      await addStoryComment(user, (await params).id, parsed.data),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof StoryError)
      return jsonError(error.message, error.status);
    return internalApiError("stories.comments.create", error);
  }
}
