import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { communityExchangeOfferSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`exchange-offer:${user.id}`, 8, 24 * 60 * 60_000)).allowed
  ) {
    return jsonError("Daily exchange offer limit reached.", 429);
  }
  const parsed = communityExchangeOfferSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid exchange offer.",
    );
  }
  try {
    if (parsed.data.cityId) {
      const city = await prisma.city.findFirst({
        where: { id: parsed.data.cityId, isActive: true },
        select: { id: true },
      });
      if (!city) return jsonError("Choose an active city.", 422);
    }
    const offer = await prisma.communityExchangeOffer.create({
      data: {
        ...parsed.data,
        ownerId: user.id,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60_000),
      },
      select: { id: true },
    });
    return Response.json({ offer }, { status: 201 });
  } catch (error) {
    return internalApiError("marketplace.exchange.create", error);
  }
}
