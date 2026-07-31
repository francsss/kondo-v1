import { NextRequest } from "next/server";
import { opportunityInterviewResponseSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { respondToOpportunityInterview } from "@/lib/opportunity-interviews";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = {
  params: Promise<{ applicationId: string; interviewId: string }>;
};

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const { applicationId, interviewId } = await params;
    const body = opportunityInterviewResponseSchema.parse(await request.json());
    return Response.json(
      await respondToOpportunityInterview({
        userId: user.id,
        applicationId,
        interviewId,
        response: body.response,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.interview.respond", error);
  }
}
