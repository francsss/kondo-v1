import { NextRequest } from "next/server";
import {
  createDirectMessage,
  findDirectConversation,
  MessagingError,
} from "@/lib/messaging";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createDirectMessageSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`message:${user.id}`, 30, 60_000).allowed) {
    return jsonError("Message limit reached. Try again shortly.", 429);
  }

  const parsed = createDirectMessageSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid message.");
  }

  const existing = await findDirectConversation(
    user.id,
    parsed.data.recipientId,
  );
  if (
    !existing &&
    !rateLimit(`new-conversation:${user.id}`, 8, 60 * 60_000).allowed
  ) {
    return jsonError("New conversation limit reached. Try again later.", 429);
  }

  try {
    const result = await createDirectMessage({
      senderId: user.id,
      ...parsed.data,
    });
    return Response.json(result, { status: existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
