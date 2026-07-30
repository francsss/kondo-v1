import { NextRequest } from "next/server";
import {
  cancelOrganizationInvitation,
  resendOrganizationInvitation,
} from "@/lib/organization-invitations";
import { organizationApiFailure } from "@/lib/organization-api";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationInvitationUpdateSchema } from "@/lib/validation";

type Context = {
  params: Promise<{ id: string; invitationId: string }>;
};

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const { id, invitationId } = await params;
    await cancelOrganizationInvitation(
      user.id,
      id,
      invitationId,
      getRequestMeta(request),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return organizationApiFailure("organizations.invitation.cancel", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationInvitationUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Check the invitation action.",
    );
  }
  try {
    const { id, invitationId } = await params;
    if (parsed.data.action === "CANCEL") {
      await cancelOrganizationInvitation(
        user.id,
        id,
        invitationId,
        getRequestMeta(request),
      );
      return new Response(null, { status: 204 });
    }
    if (
      !(
        await rateLimit(
          `organization-invite-resend:${id}:${user.id}`,
          20,
          24 * 60 * 60_000,
        )
      ).allowed
    ) {
      return jsonError(
        "Invitation resend limit reached. Try again later.",
        429,
      );
    }
    return Response.json(
      await resendOrganizationInvitation(
        user,
        id,
        invitationId,
        parsed.data.role,
        getRequestMeta(request),
      ),
    );
  } catch (error) {
    return organizationApiFailure("organizations.invitation.update", error);
  }
}
