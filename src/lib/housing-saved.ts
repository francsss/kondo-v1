import { trackEvent } from "@/lib/analytics";
import { revalidateHousing } from "@/lib/housing-cache";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import {
  publicHousingListingSelect,
  serializePublicHousingListing,
} from "@/lib/housing-listings";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

export class HousingSavedError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingSavedError";
  }
}

export async function saveHousingListing(userId: string, listingId: string) {
  const listing = await prisma.housingListing.findFirst({
    where: { id: listingId, ...publicHousingListingWhere() },
    select: { id: true },
  });
  if (!listing) throw new HousingSavedError("Housing listing not found.", 404);
  await prisma.housingSavedListing.upsert({
    where: { userId_listingId: { userId, listingId } },
    create: { userId, listingId },
    update: {},
  });
  revalidateHousing({ listingId });
  await Promise.all([
    trackEvent({
      name: "HOUSING_LISTING_SAVED",
      userId,
      properties: { listingId },
    }),
    captureServerProductEvent({
      distinctId: userId,
      event: PRODUCT_EVENTS.HOUSING_LISTING_SAVED,
      properties: { listing_id: listingId },
    }),
  ]);
  return { saved: true };
}

export async function unsaveHousingListing(userId: string, listingId: string) {
  await prisma.housingSavedListing.deleteMany({
    where: { userId, listingId },
  });
  revalidateHousing({ listingId });
  return { saved: false };
}

export async function listSavedHousing(userId: string, limit = 30) {
  const rows = await prisma.housingSavedListing.findMany({
    where: {
      userId,
      listing: publicHousingListingWhere(),
    },
    select: {
      createdAt: true,
      listing: { select: publicHousingListingSelect },
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(50, Math.max(1, limit)),
  });
  return rows.map((row) => ({
    savedAt: row.createdAt.toISOString(),
    listing: serializePublicHousingListing(row.listing),
  }));
}
