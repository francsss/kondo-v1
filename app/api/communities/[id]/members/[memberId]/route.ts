import { NextRequest } from "next/server";
import {
  CommunityError,
  removeCommunityMember,
  updateCommunityMemberRole,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { communityMemberRoleSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; memberId: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof CommunityError)
    return jsonError(error.message, error.status);
  return internalApiError(event, error);
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = communityMemberRoleSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid member role.");
  const route = await params;
  try {
    return Response.json(
      await updateCommunityMemberRole({
        actor: user,
        communityId: route.id,
        memberId: route.memberId,
        role: parsed.data.role,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return failure("communities.member.role", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const route = await params;
  try {
    await removeCommunityMember({
      actor: user,
      communityId: route.id,
      memberId: route.memberId,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("communities.member.remove", error);
  }
}
