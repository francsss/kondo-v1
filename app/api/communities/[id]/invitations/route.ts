import { NextRequest } from "next/server";
import { CommunityError, inviteCommunityMember } from "@/lib/communities";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { communityInvitationSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`community-invite:${user.id}`, 30, 60 * 60_000)).allowed
  ) {
    return jsonError("Invitation limit reached.", 429);
  }
  const parsed = communityInvitationSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Invalid invitation.");
  try {
    const target = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (!target) return jsonError("User not found.", 404);
    return Response.json(
      await inviteCommunityMember({
        actor: user,
        communityId: (await params).id,
        userId: target.id,
        note: parsed.data.note,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof CommunityError)
      return jsonError(error.message, error.status);
    return internalApiError("communities.invite", error);
  }
}
