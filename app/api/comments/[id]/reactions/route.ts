import { NextRequest } from "next/server";
import {
  CommunityError,
  setCommentReaction,
} from "@/lib/communities";
import {
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { reactionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

async function mutate(request: NextRequest, context: Context, reacted: boolean) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = reactionSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) return jsonError("Invalid reaction.");
  try {
    return Response.json(
      await setCommentReaction({
        actor: user,
        commentId: (await context.params).id,
        type: parsed.data.type,
        reacted,
      }),
    );
  } catch (error) {
    if (error instanceof CommunityError) return jsonError(error.message, error.status);
    return internalApiError("comments.reaction", error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  return mutate(request, context, true);
}

export async function DELETE(request: NextRequest, context: Context) {
  return mutate(request, context, false);
}
