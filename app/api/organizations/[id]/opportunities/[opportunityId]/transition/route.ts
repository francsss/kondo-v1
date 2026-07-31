import { NextRequest } from "next/server";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { transitionOrganizationOpportunity } from "@/lib/opportunity-management";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string; opportunityId: string }> };

const ACTIONS = ["SUBMIT", "PUBLISH", "PAUSE", "CLOSE", "ARCHIVE"] as const;

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = (await request.json()) as { action?: string };
    // Only publisher-side actions are reachable here. Moderation states such as
    // REJECTED or REMOVED are not in this list and cannot be set by a publisher.
    if (!ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
      return jsonError("Unsupported action.", 400);
    }
    const { id, opportunityId } = await params;
    return Response.json(
      await transitionOrganizationOpportunity({
        userId: user.id,
        organizationId: id,
        opportunityId,
        action: body.action as (typeof ACTIONS)[number],
      }),
    );
  } catch (error) {
    return opportunityApiFailure(
      "organizations.opportunities.transition",
      error,
    );
  }
}
