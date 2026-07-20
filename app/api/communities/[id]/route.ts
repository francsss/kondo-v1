import { NextRequest } from "next/server";
import {
  archiveOwnedCommunity,
  CommunityError,
  updateCommunity,
} from "@/lib/communities";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { updateCommunitySchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

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
  const parsed = updateCommunitySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid community.");
  }
  try {
    return Response.json(
      await updateCommunity({
        actor: user,
        communityId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return failure("communities.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await archiveOwnedCommunity({
      actor: user,
      communityId: (await params).id,
      meta: getRequestMeta(request),
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure("communities.archive", error);
  }
}
