import { NextRequest } from "next/server";
import { getOrganizationApplication } from "@/lib/opportunity-application-review";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; applicationId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, applicationId } = await params;
    return Response.json(
      await getOrganizationApplication({
        userId: user.id,
        organizationId: id,
        applicationId,
      }),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return opportunityApiFailure("organizations.applications.get", error);
  }
}
