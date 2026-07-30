import { NextRequest } from "next/server";
import { createOrganizationInvitation } from "@/lib/organization-invitations";
import { organizationApiFailure } from "@/lib/organization-api";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationInvitationCreateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const organizationId = (await params).id;
  if (
    !(
      await rateLimit(
        `organization-invite:${organizationId}:${user.id}`,
        20,
        24 * 60 * 60_000,
      )
    ).allowed
  ) {
    return jsonError("Invitation limit reached. Try again later.", 429);
  }
  const parsed = organizationInvitationCreateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the invitation.",
    );
  }
  try {
    return Response.json(
      await createOrganizationInvitation(
        user,
        organizationId,
        parsed.data,
        getRequestMeta(request),
      ),
      { status: 201 },
    );
  } catch (error) {
    return organizationApiFailure("organizations.invitation.create", error);
  }
}
