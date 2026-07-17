import { NextRequest } from "next/server";
import {
  markConversationRead,
  MessagingError,
} from "@/lib/messaging";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { conversationReadSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id } = await params;
  const parsed = conversationReadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid read position.",
    );
  }

  try {
    return Response.json(
      await markConversationRead({
        conversationId: id,
        userId: user.id,
        latestMessageId: parsed.data.latestMessageId,
      }),
    );
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
