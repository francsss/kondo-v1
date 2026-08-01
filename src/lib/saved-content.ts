import { activeListingWhere } from "@/lib/content-visibility";
import { listSavedHousing } from "@/lib/housing-saved";
import { listSavedOpportunities } from "@/lib/opportunity-saved";
import { listSavedCatalog } from "@/lib/organization-catalog";
import { prisma } from "@/lib/prisma";

export type SavedContentType =
  "opportunity" | "housing" | "product" | "service" | "marketplace";

export type UnifiedSavedItem = {
  key: string;
  type: SavedContentType;
  title: string;
  description: string | null;
  href: string | null;
  savedAt: string;
  available: boolean;
  eyebrow: string;
};

export async function listUnifiedSaved(input: {
  userId: string;
  type?: SavedContentType | "all";
  sort?: "newest" | "oldest";
}) {
  const [
    opportunities,
    housing,
    catalog,
    marketplaceRows,
    housingSavedRows,
    productSavedRows,
    serviceSavedRows,
  ] = await Promise.all([
    listSavedOpportunities({ userId: input.userId, limit: 50 }),
    listSavedHousing(input.userId, 50),
    listSavedCatalog(input.userId),
    prisma.listingFavorite.findMany({
      where: { userId: input.userId },
      select: {
        createdAt: true,
        listing: {
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            status: true,
            expiresAt: true,
            category: { select: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.housingSavedListing.findMany({
      where: { userId: input.userId },
      select: { listingId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.organizationProductSaved.findMany({
      where: { userId: input.userId },
      select: { productId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.organizationServiceSaved.findMany({
      where: { userId: input.userId },
      select: { serviceId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);
  const visibleMarketplaceIds = new Set(
    (
      await prisma.marketplaceListing.findMany({
        where: {
          id: { in: marketplaceRows.map(({ listing }) => listing.id) },
          ...activeListingWhere(),
        },
        select: { id: true },
      })
    ).map(({ id }) => id),
  );
  const visibleHousingIds = new Set(housing.map(({ listing }) => listing.id));
  const visibleProductIds = new Set(catalog.products.map(({ id }) => id));
  const visibleServiceIds = new Set(catalog.services.map(({ id }) => id));
  const items: UnifiedSavedItem[] = [
    ...opportunities.map((entry) => ({
      key: `opportunity:${entry.opportunityId}`,
      type: "opportunity" as const,
      title: entry.opportunity?.title ?? "Saved opportunity unavailable",
      description: entry.opportunity?.summary ?? null,
      href: entry.opportunity
        ? `/opportunities/${entry.opportunity.slug}`
        : null,
      savedAt: entry.savedAt,
      available: entry.available,
      eyebrow: "Opportunity",
    })),
    ...housing.map(({ listing, savedAt }) => ({
      key: `housing:${listing.id}`,
      type: "housing" as const,
      title: listing.title,
      description: listing.shortDescription ?? listing.location.label ?? null,
      href: `/housing/listings/${listing.slug}`,
      savedAt,
      available: true,
      eyebrow: "Housing",
    })),
    ...housingSavedRows
      .filter((row) => !visibleHousingIds.has(row.listingId))
      .map((row) => ({
        key: `housing:${row.listingId}`,
        type: "housing" as const,
        title: "Saved housing unavailable",
        description: null,
        href: null,
        savedAt: row.createdAt.toISOString(),
        available: false,
        eyebrow: "Housing",
      })),
    ...catalog.products.map((item) => ({
      key: `product:${item.id}`,
      type: "product" as const,
      title: item.title,
      description: item.shortDescription,
      href: item.href,
      savedAt: item.savedAt,
      available: true,
      eyebrow: "Organization product",
    })),
    ...catalog.services.map((item) => ({
      key: `service:${item.id}`,
      type: "service" as const,
      title: item.title,
      description: item.shortDescription,
      href: item.href,
      savedAt: item.savedAt,
      available: true,
      eyebrow: "Organization service",
    })),
    ...productSavedRows
      .filter((row) => !visibleProductIds.has(row.productId))
      .map((row) => ({
        key: `product:${row.productId}`,
        type: "product" as const,
        title: "Saved product unavailable",
        description: null,
        href: null,
        savedAt: row.createdAt.toISOString(),
        available: false,
        eyebrow: "Organization product",
      })),
    ...serviceSavedRows
      .filter((row) => !visibleServiceIds.has(row.serviceId))
      .map((row) => ({
        key: `service:${row.serviceId}`,
        type: "service" as const,
        title: "Saved service unavailable",
        description: null,
        href: null,
        savedAt: row.createdAt.toISOString(),
        available: false,
        eyebrow: "Organization service",
      })),
    ...marketplaceRows.map(({ createdAt, listing }) => {
      const available = visibleMarketplaceIds.has(listing.id);
      return {
        key: `marketplace:${listing.id}`,
        type: "marketplace" as const,
        title: available ? listing.title : "Saved marketplace item unavailable",
        description: available ? listing.description : null,
        href: available ? `/marketplace/${listing.slug}` : null,
        savedAt: createdAt.toISOString(),
        available,
        eyebrow: "Marketplace",
      };
    }),
  ];
  const filtered =
    input.type && input.type !== "all"
      ? items.filter(({ type }) => type === input.type)
      : items;
  return filtered.sort((left, right) => {
    const value =
      new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime();
    return input.sort === "oldest" ? -value : value;
  });
}
