import { NextRequest } from "next/server";
import { openMarketplaceConversation } from "@/lib/marketplace-messaging";
import { MessagingError } from "@/lib/messaging";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * Open — or re-open — this buyer's conversation about a listing.
 *
 * A POST rather than a link, because it writes. A GET would be prefetched by
 * the router as soon as "Chat with seller" scrolled into view, and every
 * passer-by would silently appear in the seller's inbox.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`marketplace-chat:${user.id}`, 20, 60_000)).allowed) {
    return jsonError("Too many conversations started. Try again shortly.", 429);
  }

  try {
    const result = await openMarketplaceConversation({
      listingId: (await params).id,
      buyerId: user.id,
    });
    return Response.json(result, { status: result.new ? 201 : 200 });
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    throw error;
  }
}
