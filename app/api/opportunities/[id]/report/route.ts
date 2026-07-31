import { NextRequest } from "next/server";
import { opportunityReportSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { createOrReuseOpportunityReport } from "@/lib/opportunity-moderation";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    // Reporting is abuse-prone, so it is rate limited per reporter.
    if (
      !(await rateLimit(`opportunity-report:${user.id}`, 10, 60 * 60_000))
        .allowed
    ) {
      return jsonError("Too many reports. Try again later.", 429);
    }
    const body = opportunityReportSchema.parse(await request.json());
    const result = await createOrReuseOpportunityReport({
      actorId: user.id,
      opportunityId: (await params).id,
      reason: body.reason,
      details: body.details ?? null,
    });
    // The reporter never learns whether a case already existed from someone
    // else, and no reporter identity is returned.
    return Response.json(
      { received: true },
      { status: result.reused ? 200 : 201 },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.report", error);
  }
}
