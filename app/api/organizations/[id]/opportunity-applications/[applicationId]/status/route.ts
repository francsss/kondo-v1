import { NextRequest } from "next/server";
import { applicationStatusChangeSchema } from "@/features/opportunities/schemas";
import { reviewerChangeApplicationStatus } from "@/lib/opportunity-application-review";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; applicationId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = applicationStatusChangeSchema.parse(await request.json());
    const { id, applicationId } = await params;
    return Response.json(
      await reviewerChangeApplicationStatus({
        userId: user.id,
        organizationId: id,
        applicationId,
        toStatus: body.toStatus,
        applicantVisibleNote: body.applicantVisibleNote ?? null,
        internalNote: body.internalNote ?? null,
        informationDueAt: body.informationDueAt ?? null,
        offerResponseDueAt: body.offerResponseDueAt ?? null,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("organizations.applications.status", error);
  }
}
