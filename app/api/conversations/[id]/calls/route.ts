import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createPrivateCall,
  getAvailablePrivateCall,
} from "@/lib/calls/service";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const createSchema = z.object({ kind: z.enum(["AUDIO", "VIDEO"]) });

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const call = await getAvailablePrivateCall((await params).id, user.id);
    return Response.json(
      { call },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return internalApiError("conversations.calls.get", error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose an audio or video call.");
  try {
    const call = await createPrivateCall({
      conversationId: (await params).id,
      userId: user.id,
      kind: parsed.data.kind,
    });
    if (!call) return jsonError("Conversation not found.", 404);
    return Response.json({ call }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("unavailable")) {
      return jsonError(error.message, 403);
    }
    return internalApiError("conversations.calls.create", error);
  }
}
