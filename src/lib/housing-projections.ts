import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { prisma } from "@/lib/prisma";

export async function getOrganizationHousingProjection(organizationId: string) {
  const listings = await prisma.housingListing.findMany({
    where: {
      publisherOrganizationId: organizationId,
      ...publicHousingListingWhere(),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      publicLocationLabel: true,
      city: { select: { name: true } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: 4,
  });
  const itemCount = await prisma.housingListing.count({
    where: {
      publisherOrganizationId: organizationId,
      ...publicHousingListingWhere(),
    },
  });
  return {
    available: itemCount > 0,
    itemCount,
    featuredItems: listings.map((listing) => ({
      id: listing.id,
      title: listing.title,
      href: `/housing/listings/${listing.slug}`,
      context: `${listing.publicLocationLabel}, ${listing.city.name}`,
    })),
    sectionRoute: `/housing/search?publisher=ORGANIZATION&organizationId=${encodeURIComponent(organizationId)}`,
    visibility: itemCount > 0 ? ("PUBLIC" as const) : ("HIDDEN" as const),
  };
}

export async function getCityHousingProjection(cityId: string, limit = 6) {
  return prisma.housingListing.findMany({
    where: { cityId, ...publicHousingListingWhere() },
    select: {
      id: true,
      slug: true,
      title: true,
      type: true,
      monthlyRentMinor: true,
      currency: true,
      publicLocationLabel: true,
      publisherOrganization: { select: { publicName: true } },
      media: {
        where: { isCover: true, kind: { not: "PROOF_DOCUMENT" } },
        select: { mediaId: true, altText: true },
        take: 1,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: Math.min(12, Math.max(1, limit)),
  });
}
