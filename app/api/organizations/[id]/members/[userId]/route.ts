import { NextRequest } from "next/server";
import {
  changeOrganizationMemberRole,
  removeOrganizationMember,
} from "@/lib/organization-memberships";
import { organizationApiFailure } from "@/lib/organization-api";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { organizationMemberUpdateSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = organizationMemberUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Select a valid role.");
  }
  try {
    const { id, userId } = await params;
    return Response.json({
      membership: await changeOrganizationMemberRole(
        user,
        id,
        userId,
        parsed.data.role,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.team.role", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    const { id, userId } = await params;
    await removeOrganizationMember(user, id, userId, getRequestMeta(request));
    return new Response(null, { status: 204 });
  } catch (error) {
    return organizationApiFailure("organizations.team.remove", error);
  }
}
