import { NextRequest } from "next/server";
import {
  getConversationMessagesForUser,
  MessagingError,
  replyToConversation,
} from "@/lib/messaging";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createConversationMessageSchema } from "@/lib/validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const cursor = request.nextUrl.searchParams.get("cursor")?.trim();
  const direction = request.nextUrl.searchParams.get("direction");
  if (cursor && !/^c[a-z0-9]{20,}$/i.test(cursor)) {
    return jsonError("Invalid message position.");
  }
  if (direction && direction !== "older" && direction !== "newer") {
    return jsonError("Invalid message direction.");
  }

  try {
    const result = await getConversationMessagesForUser({
      conversationId: (await params).id,
      userId: user.id,
      cursor: cursor || undefined,
      direction: direction === "older" ? "older" : "newer",
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`message:${user.id}`, 30, 60_000)).allowed) {
    return jsonError("Message limit reached. Try again shortly.", 429);
  }

  const parsed = createConversationMessageSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid message.");
  }
  const { id } = await params;

  try {
    const result = await replyToConversation({
      conversationId: id,
      senderId: user.id,
      ...parsed.data,
    });
    return Response.json(result, {
      status: result.deduplicated ? 200 : 201,
    });
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
