import { NextRequest } from "next/server";
import { authorizeAdminApi } from "@/lib/admin-auth";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { moderateOpportunity } from "@/lib/opportunity-moderation";
import { hasTrustedOrigin, jsonError } from "@/lib/request";

type Context = { params: Promise<{ id: string }> };

const ACTIONS = [
  "APPROVE",
  "REJECT",
  "PAUSE",
  "REMOVE",
  "RESTORE",
  "BLOCK_EXTERNAL_SOURCE",
] as const;

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const body = (await request.json()) as {
      action?: string;
      publisherVisibleNote?: string;
      internalNote?: string;
    };
    if (!ACTIONS.includes(body.action as (typeof ACTIONS)[number])) {
      return jsonError("Unsupported moderation action.", 400);
    }
    // Removal is a separate, stronger permission than ordinary review.
    const permission =
      body.action === "REMOVE"
        ? "OPPORTUNITIES_REMOVE"
        : "OPPORTUNITIES_REVIEW";
    const auth = await authorizeAdminApi(permission);
    if (!auth.authorized) return auth.error;

    return Response.json(
      await moderateOpportunity({
        adminUserId: auth.user.id,
        opportunityId: (await params).id,
        action: body.action as (typeof ACTIONS)[number],
        publisherVisibleNote: body.publisherVisibleNote ?? null,
        internalNote: body.internalNote ?? null,
      }),
    );
  } catch (error) {
    return opportunityApiFailure("admin.opportunities.moderate", error);
  }
}
