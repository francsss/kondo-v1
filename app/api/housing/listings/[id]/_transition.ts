import { NextRequest } from "next/server";
import type { HousingListingStatus } from "@prisma/client";
import { hasAdminPermission } from "@/lib/authorization";
import { housingApiFailure } from "@/lib/housing-api";
import { transitionHousingListing } from "@/lib/housing-listings";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export function createHousingTransitionHandler(to: HousingListingStatus) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = await request.json().catch(() => ({}));
    const adminPermission =
      to === "REMOVED"
        ? ("HOUSING_LISTINGS_REMOVE" as const)
        : to === "PAUSED"
          ? ("HOUSING_MODERATE" as const)
          : to === "PUBLISHED" || to === "REJECTED"
            ? ("HOUSING_LISTINGS_REVIEW" as const)
            : null;
    const admin = Boolean(
      adminPermission && hasAdminPermission(user.role, adminPermission),
    );
    try {
      return Response.json(
        await transitionHousingListing({
          actorId: user.id,
          actor: admin ? "ADMIN" : "PUBLISHER",
          listingId: (await params).id,
          to,
          reason: typeof body?.reason === "string" ? body.reason : undefined,
          expectedVersion:
            typeof body?.expectedVersion === "number"
              ? body.expectedVersion
              : undefined,
          meta: getRequestMeta(request),
        }),
      );
    } catch (error) {
      return housingApiFailure(`housing.listings.${to.toLowerCase()}`, error);
    }
  };
}
