import { NextRequest } from "next/server";
import { housingListingInputSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import {
  getPublicHousingListing,
  transitionHousingListing,
  updateHousingListing,
} from "@/lib/housing-listings";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  const listing = await getPublicHousingListing((await params).id, user?.id);
  if (!listing) return jsonError("Housing listing not found.", 404);
  return Response.json(listing, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const body = await request.json().catch(() => null);
  const parsed = housingListingInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Housing listing.",
    );
  }
  try {
    return Response.json(
      await updateHousingListing({
        actorId: user.id,
        listingId: (await params).id,
        data: parsed.data,
        expectedVersion:
          typeof body?.expectedVersion === "number"
            ? body.expectedVersion
            : undefined,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.listings.update", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await transitionHousingListing({
        actorId: user.id,
        actor: "PUBLISHER",
        listingId: (await params).id,
        to: "ARCHIVED",
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.listings.archive", error);
  }
}
