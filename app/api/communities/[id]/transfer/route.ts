import { NextRequest } from "next/server";
import { CommunityError, transferCommunityOwnership } from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { transferCommunitySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = transferCommunitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid ownership transfer.");
  try {
    return Response.json(
      await transferCommunityOwnership({
        actor: user,
        communityId: (await params).id,
        targetUserId: parsed.data.userId,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CommunityError)
      return jsonError(error.message, error.status);
    return internalApiError("communities.transfer", error);
  }
}
