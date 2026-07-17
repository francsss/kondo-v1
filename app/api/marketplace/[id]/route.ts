import { NextRequest } from "next/server";
import { MarketplaceError, updateMarketplaceListing } from "@/lib/marketplace";
import { getRequestMeta, hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { updateListingSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = updateListingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid listing.");
  try {
    return Response.json(await updateMarketplaceListing({
      actor: user,
      listingId: (await params).id,
      data: parsed.data,
      meta: getRequestMeta(request),
    }));
  } catch (error) {
    if (error instanceof MarketplaceError) return jsonError(error.message, error.status);
    return internalApiError("marketplace.update", error);
  }
}
