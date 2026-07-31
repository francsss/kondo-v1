import { NextRequest } from "next/server";
import { opportunityAuthoringSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import {
  getOrganizationOpportunityForEdit,
  updateOrganizationOpportunity,
} from "@/lib/opportunity-management";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; opportunityId: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, opportunityId } = await params;
    return Response.json(
      await getOrganizationOpportunityForEdit({
        userId: user.id,
        organizationId: id,
        opportunityId,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.get", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, opportunityId } = await params;
    const payload = opportunityAuthoringSchema.parse(await request.json());
    return Response.json(
      await updateOrganizationOpportunity({
        userId: user.id,
        organizationId: id,
        opportunityId,
        ...payload,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.update", error);
  }
}
