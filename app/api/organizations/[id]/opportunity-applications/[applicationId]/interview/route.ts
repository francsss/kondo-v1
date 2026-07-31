import { NextRequest } from "next/server";
import { opportunityInterviewSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { scheduleOpportunityInterview } from "@/lib/opportunity-interviews";
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
    const { id, applicationId } = await params;
    const body = opportunityInterviewSchema.parse(await request.json());
    return Response.json(
      await scheduleOpportunityInterview({
        userId: user.id,
        organizationId: id,
        applicationId,
        ...body,
      }),
      { status: 201 },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.interview.schedule", error);
  }
}
