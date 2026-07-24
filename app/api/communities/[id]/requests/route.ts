import { NextRequest } from "next/server";
import {
  CommunityRequestError,
  createCommunityRequest,
} from "@/lib/community-requests";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { createCommunityRequestSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`community-request:${user.id}`, 12, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Request limit reached. Try again later.", 429);
  }
  const parsed = createCommunityRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request.");
  }

  try {
    return Response.json(
      await createCommunityRequest({
        actor: user,
        communityId: (await params).id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityRequestError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("community_requests.create", error);
  }
}
