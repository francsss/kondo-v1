import { NextRequest } from "next/server";
import { leaveOrganization } from "@/lib/organization-memberships";
import { organizationApiFailure } from "@/lib/organization-api";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await leaveOrganization(
      user.id,
      (await params).id,
      getRequestMeta(request),
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return organizationApiFailure("organizations.leave", error);
  }
}
