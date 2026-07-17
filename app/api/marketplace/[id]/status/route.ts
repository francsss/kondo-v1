import { NextRequest } from "next/server";
import { MarketplaceError, transitionMarketplaceListing } from "@/lib/marketplace";
import { getRequestMeta, hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { listingTransitionSchema } from "@/lib/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasTrustedOrigin(request)) return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = listingTransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid listing transition.");
  try {
    return Response.json(await transitionMarketplaceListing({
      actor: user,
      listingId: (await params).id,
      ...parsed.data,
      meta: getRequestMeta(request),
    }));
  } catch (error) {
    if (error instanceof MarketplaceError) return jsonError(error.message, error.status);
    return internalApiError("marketplace.transition", error);
  }
}
