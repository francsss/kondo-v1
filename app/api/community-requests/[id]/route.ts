import { NextRequest } from "next/server";
import {
  closeCommunityRequest,
  CommunityRequestError,
} from "@/lib/community-requests";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { closeCommunityRequestSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = closeCommunityRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid request status.");

  try {
    return Response.json(
      await closeCommunityRequest({
        actor: user,
        requestId: (await params).id,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    if (error instanceof CommunityRequestError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("community_requests.close", error);
  }
}
