import { NextRequest } from "next/server";
import {
  clearConversationForUser,
  MessagingError,
  setConversationArchived,
} from "@/lib/messaging";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { conversationArchiveSchema } from "@/lib/validation";

async function authorize(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return { error: jsonError("Invalid request origin.", 403) };
  }
  const user = await getCurrentUser();
  if (!user) return { error: jsonError("Authentication required.", 401) };
  return { user };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  const parsed = conversationArchiveSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid archive setting.",
    );
  }
  try {
    return Response.json(
      await setConversationArchived({
        conversationId: (await params).id,
        userId: auth.user!.id,
        archived: parsed.data.archived,
      }),
    );
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("conversation.archive", error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorize(request);
  if (auth.error) return auth.error;
  try {
    return Response.json(
      await clearConversationForUser({
        conversationId: (await params).id,
        userId: auth.user!.id,
        metadata: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("conversation.clear", error);
  }
}
