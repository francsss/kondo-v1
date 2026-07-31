import { NextRequest } from "next/server";
import { respondToOfferDecision } from "@/lib/opportunity-applications";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ applicationId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = (await request.json()) as { decision?: string };
    if (body.decision !== "ACCEPT" && body.decision !== "DECLINE") {
      return jsonError("Choose accept or decline.", 400);
    }
    return Response.json(
      await respondToOfferDecision({
        userId: user.id,
        applicationId: (await params).applicationId,
        decision:
          body.decision === "ACCEPT" ? "ACCEPTED" : "DECLINED_BY_APPLICANT",
      }),
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.offer", error);
  }
}
