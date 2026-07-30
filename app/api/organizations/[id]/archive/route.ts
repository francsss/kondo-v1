import { NextRequest } from "next/server";
import { organizationApiFailure } from "@/lib/organization-api";
import { archiveOrganization } from "@/lib/organizations";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json({
      organization: await archiveOrganization(
        user,
        (await params).id,
        getRequestMeta(request),
      ),
    });
  } catch (error) {
    return organizationApiFailure("organizations.archive", error);
  }
}
