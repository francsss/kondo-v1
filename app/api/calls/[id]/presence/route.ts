import { NextRequest } from "next/server";
import { z } from "zod";
import { updateCallPresence } from "@/lib/calls/service";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const presenceSchema = z.object({ status: z.enum(["JOINED", "LEFT"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = presenceSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid call state.");
  try {
    const changed = await updateCallPresence({
      callId: (await params).id,
      userId: user.id,
      status: parsed.data.status,
    });
    if (!changed) return jsonError("Call not found.", 404);
    return Response.json({ status: parsed.data.status });
  } catch (error) {
    return internalApiError("calls.presence", error);
  }
}
