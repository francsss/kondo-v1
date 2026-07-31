import { NextRequest } from "next/server";
import { opportunityAuthoringSchema } from "@/features/opportunities/schemas";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import {
  createOrganizationOpportunity,
  listOrganizationOpportunities,
} from "@/lib/opportunity-management";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    return Response.json({
      items: await listOrganizationOpportunities({
        userId: user.id,
        organizationId: (await params).id,
      }),
    });
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.list", error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    if (!hasTrustedOrigin(request)) {
      return jsonError("Invalid request origin.", 403);
    }
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    if (
      !(await rateLimit(`opportunity-create:${user.id}`, 30, 24 * 60 * 60_000))
        .allowed
    ) {
      return jsonError("Too many opportunities created today.", 429);
    }
    const payload = opportunityAuthoringSchema.parse(await request.json());
    return Response.json(
      await createOrganizationOpportunity({
        userId: user.id,
        organizationId: (await params).id,
        ...payload,
      }),
      { status: 201 },
    );
  } catch (error) {
    return opportunityApiFailure("organizations.opportunities.create", error);
  }
}
