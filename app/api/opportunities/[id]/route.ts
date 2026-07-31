import { getPublicOpportunityBySlug } from "@/lib/opportunities";
import { opportunityApiFailure } from "@/lib/opportunity-api";
import { jsonError } from "@/lib/request";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    const opportunity = await getPublicOpportunityBySlug((await params).id);
    if (!opportunity) return jsonError("Opportunity not found.", 404);
    return Response.json(opportunity);
  } catch (error) {
    return opportunityApiFailure("opportunities.detail", error);
  }
}
