import { NextRequest } from "next/server";
import {
  CommunityRequestError,
  offerCommunityRequestHelp,
} from "@/lib/community-requests";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`community-request-help:${user.id}`, 30, 60 * 60_000))
      .allowed
  ) {
    return jsonError("Help offer limit reached. Try again later.", 429);
  }

  try {
    return Response.json(
      await offerCommunityRequestHelp({
        actor: user,
        requestId: (await params).id,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityRequestError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("community_requests.help", error);
  }
}
