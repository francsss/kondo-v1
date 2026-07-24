import { NextRequest } from "next/server";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { reviseStorySubmission, StoryError } from "@/lib/stories";
import { storyRevisionSchema } from "@/lib/story-validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = storyRevisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid revision.");
  }
  try {
    const story = await reviseStorySubmission(
      user,
      (await params).id,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ story });
  } catch (error) {
    if (error instanceof StoryError)
      return jsonError(error.message, error.status);
    return internalApiError("stories.revise", error);
  }
}
