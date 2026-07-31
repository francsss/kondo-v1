import { NextRequest } from "next/server";
import {
  housingListingInputSchema,
  housingSearchSchema,
} from "@/features/housing/schemas";
import { housingApiFailure, splitQueryValues } from "@/lib/housing-api";
import { createHousingListing } from "@/lib/housing-listings";
import { searchHousing } from "@/lib/housing-search";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = housingSearchSchema.safeParse({
    q: params.get("q") || undefined,
    cityId: params.get("cityId") || undefined,
    district: params.get("district") || undefined,
    universityId: params.get("universityId") || undefined,
    organizationId: params.get("organizationId") || undefined,
    types: splitQueryValues(params.get("types")),
    minimumRentMinor: params.get("minimumRentMinor") || undefined,
    maximumRentMinor: params.get("maximumRentMinor") || undefined,
    currency: params.get("currency") || undefined,
    bedrooms: params.get("bedrooms") || undefined,
    availableFrom: params.get("availableFrom") || undefined,
    minimumStayMonths: params.get("minimumStayMonths") || undefined,
    furnished: params.get("furnished") || undefined,
    amenities: splitQueryValues(params.get("amenities")),
    publisher: params.get("publisher") || undefined,
    petPolicy: params.get("petPolicy") || undefined,
    smokingPolicy: params.get("smokingPolicy") || undefined,
    sort: params.get("sort") || undefined,
    cursor: params.get("cursor") || undefined,
    limit: params.get("limit") || undefined,
  });
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Housing search.",
    );
  }
  try {
    return Response.json(await searchHousing(parsed.data), {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
      },
    });
  } catch (error) {
    return housingApiFailure("housing.listings.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`housing-listing:${user.id}`, 12, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Daily Housing listing limit reached.", 429);
  }
  const parsed = housingListingInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Housing listing.",
    );
  }
  try {
    return Response.json(
      await createHousingListing({
        actorId: user.id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.listings.create", error);
  }
}
