import { NextRequest } from "next/server";
import {
  cancelCommunityAccessRequest,
  CommunityError,
  resolveCommunityAccess,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { communityAccessResolutionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; requestId: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof CommunityError) return jsonError(error.message, error.status);
  return internalApiError(event, error);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = communityAccessResolutionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid access decision.");
  const route = await params;
  try {
    return Response.json(
      await resolveCommunityAccess({
        actor: user,
        communityId: route.id,
        requestId: route.requestId,
        ...parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return failure("communities.access.resolve", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const route = await params;
  try {
    await cancelCommunityAccessRequest({
      actor: user,
      communityId: route.id,
      requestId: route.requestId,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("communities.access.cancel", error);
  }
}
