import { NextRequest } from "next/server";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { StoryError, updateStoryInteraction } from "@/lib/stories";
import { storyInteractionSchema } from "@/lib/story-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = storyInteractionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid interaction.");
  }
  try {
    return Response.json(
      await updateStoryInteraction(user, (await params).id, parsed.data),
    );
  } catch (error) {
    if (error instanceof StoryError)
      return jsonError(error.message, error.status);
    return internalApiError("stories.interaction", error);
  }
}
