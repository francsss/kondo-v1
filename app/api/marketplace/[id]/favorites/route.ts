import { NextRequest } from "next/server";
import { activeListingWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: listingId } = await params;
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: listingId, ...activeListingWhere() },
    select: { id: true },
  });
  if (!listing) return jsonError("Listing not found.", 404);

  const favorite = await prisma.listingFavorite.upsert({
    where: { listingId_userId: { listingId, userId: user.id } },
    create: { listingId, userId: user.id },
    update: {},
    select: { id: true },
  });
  return Response.json({ favorited: Boolean(favorite.id) }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const { id: listingId } = await params;
  const listing = await prisma.marketplaceListing.findFirst({
    where: { id: listingId, ...activeListingWhere() },
    select: { id: true },
  });
  if (!listing) return jsonError("Listing not found.", 404);

  await prisma.listingFavorite.deleteMany({
    where: { listingId, userId: user.id },
  });
  return new Response(null, { status: 204 });
}
