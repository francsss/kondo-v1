import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createStorySubmission, getStoryFeed, StoryError } from "@/lib/stories";
import { storySubmissionSchema } from "@/lib/story-validation";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const stories = await getStoryFeed(user, {
      storySlug: request.nextUrl.searchParams.get("story") ?? undefined,
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 18),
    });
    return Response.json(
      { stories },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    if (error instanceof StoryError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("stories.feed", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`story-submit:${user.id}`, 8, 24 * 60 * 60_000)).allowed
  ) {
    return jsonError("Story submission limit reached. Try again later.", 429);
  }
  const parsed = storySubmissionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Story submission.",
    );
  }
  try {
    const story = await createStorySubmission(
      user,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ story }, { status: 201 });
  } catch (error) {
    if (error instanceof StoryError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("stories.submit", error);
  }
}
