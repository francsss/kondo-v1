import { NextRequest } from "next/server";
import {
  CommunityError,
  leaveCommunity,
  requestCommunityAccess,
} from "@/lib/communities";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { communityAccessCreateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function failure(event: string, error: unknown) {
  if (error instanceof CommunityError) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`community-access:${user.id}`, 20, 60 * 60_000)).allowed
  ) {
    return jsonError("Too many community access attempts.", 429);
  }
  const parsed = communityAccessCreateSchema
    .omit({ userId: true })
    .safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return jsonError("Invalid access request.");
  try {
    return Response.json(
      await requestCommunityAccess({
        actor: user,
        communityId: (await params).id,
        note: parsed.data.note,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return failure("communities.access.request", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await leaveCommunity({
      actor: user,
      communityId: (await params).id,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("communities.leave", error);
  }
}
