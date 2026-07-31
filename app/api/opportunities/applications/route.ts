import { NextRequest } from "next/server";
import {
  listApplicationsForApplicant,
  startApplication,
} from "@/lib/opportunity-applications";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json({
      items: await listApplicationsForApplicant(user.id),
    });
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.list", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    if (
      !(await rateLimit(`opportunity-apply:${user.id}`, 30, 60 * 60_000))
        .allowed
    ) {
      return jsonError("Too many application attempts. Try again later.", 429);
    }
    const body = (await request.json()) as { opportunityId?: string };
    if (!body.opportunityId) return jsonError("Opportunity is required.", 400);
    return Response.json(
      await startApplication({
        userId: user.id,
        opportunityId: body.opportunityId,
      }),
      { status: 201 },
    );
  } catch (error) {
    return opportunityApiFailure("opportunities.applications.start", error);
  }
}
