import { NextRequest } from "next/server";
import { roommateDiscoverySchema } from "@/features/housing/schemas";
import { housingApiFailure, splitQueryValues } from "@/lib/housing-api";
import { discoverRoommateProfiles } from "@/lib/roommate-profiles";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const params = request.nextUrl.searchParams;
  const parsed = roommateDiscoverySchema.safeParse({
    cityId: params.get("cityId") || undefined,
    universityId: params.get("universityId") || undefined,
    moveInFrom: params.get("moveInFrom") || undefined,
    moveInTo: params.get("moveInTo") || undefined,
    maximumBudgetMinor: params.get("maximumBudgetMinor") || undefined,
    languages: splitQueryValues(params.get("languages")),
    smokingPreference: params.get("smokingPreference") || undefined,
    petPreference: params.get("petPreference") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") || undefined,
  });
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid roommate search.",
    );
  try {
    return Response.json(
      await discoverRoommateProfiles({ viewerId: user.id, query: parsed.data }),
    );
  } catch (error) {
    return housingApiFailure("housing.roommates.list", error);
  }
}
