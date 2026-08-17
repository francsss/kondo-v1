import { NextRequest } from "next/server";
import { internalApiError, jsonError } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * What Kondo believes about one order.
 *
 * The payment result page polls this rather than reading anything Alipay put
 * in the return URL. A browser arriving back from a gateway is a UX event, not
 * evidence: the authoritative answer is this row, and this row only changes
 * when a signed notification is verified.
 */

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ reference: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  try {
    const order = await prisma.studyEssentialOrder.findFirst({
      // Scoped to the caller, so an order reference is not a lookup key for
      // somebody else's purchase.
      where: { reference: (await params).reference, userId: user.id },
      select: {
        reference: true,
        status: true,
        titleSnapshot: true,
        totalMinor: true,
        currency: true,
        paidAt: true,
        essential: { select: { slug: true } },
      },
    });
    if (!order) return jsonError("Order not found.", 404);

    return Response.json(
      { ...order, slug: order.essential.slug },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("study.orders.get", error);
  }
}
