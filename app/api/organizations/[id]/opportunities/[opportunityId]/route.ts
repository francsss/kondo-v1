import { NextRequest } from "next/server";
import {
  jobDetailSchema,
  opportunityDraftSchema,
  scholarshipDetailSchema,
} from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { updateOrganizationOpportunity } from "@/lib/opportunity-management";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; opportunityId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { id, opportunityId } = await params;
    const payload = (await request.json()) as Record<string, unknown>;
    return Response.json(
      await updateOrganizationOpportunity({
        userId: user.id,
        organizationId: id,
        opportunityId,
        draft: opportunityDraftSchema.parse(payload.draft),
        scholarship: payload.scholarship
          ? scholarshipDetailSchema.parse(payload.scholarship)
          : null,
        job: payload.job ? jobDetailSchema.parse(payload.job) : null,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.update", error);
  }
}
