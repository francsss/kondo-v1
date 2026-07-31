import { NextRequest } from "next/server";
import { opportunityApiFailure, splitQueryValues } from "@/lib/opportunity-api";
import { searchOpportunities } from "@/lib/opportunity-search";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const user = await getCurrentUser();
    const results = await searchOpportunities({
      viewerUserId: user?.id ?? null,
      query: params.get("q"),
      category: params.get("category"),
      types: splitQueryValues(params.get("types")),
      countryId: params.get("countryId"),
      cityId: params.get("cityId"),
      universityId: params.get("universityId"),
      workModes: splitQueryValues(params.get("workMode")),
      degreeLevels: splitQueryValues(params.get("degreeLevel")),
      fieldsOfStudy: splitQueryValues(params.get("field")),
      fundingTypes: splitQueryValues(params.get("funding")),
      employmentTypes: splitQueryValues(params.get("employment")),
      languages: splitQueryValues(params.get("language")),
      applicationMethods: splitQueryValues(params.get("applicationMethod")),
      paidOnly: params.get("paid") === "true",
      verifiedOnly: params.get("verified") === "true",
      officialPartnerOnly: params.get("partner") === "true",
      savedByUserId: params.get("saved") === "true" ? (user?.id ?? null) : null,
      cursor: params.get("cursor"),
      limit: Number(params.get("limit")) || 12,
    });
    return Response.json(results);
  } catch (error) {
    return opportunityApiFailure("opportunities.search", error);
  }
}
