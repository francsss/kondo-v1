import { NextRequest } from "next/server";
import { decideOrganizationInvitationById } from "@/lib/organization-invitations";
import { organizationApiFailure } from "@/lib/organization-api";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationInvitationDecisionSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationInvitationDecisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return jsonError("Select a valid invitation action.");
  try {
    return Response.json({
      invitation: await decideOrganizationInvitationById(
        user,
        (await params).id,
        parsed.data.action,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.invitation.decision", error);
  }
}
