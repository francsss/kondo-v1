import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { organizationPublicVisibilityWhere } from "@/lib/organization-public-visibility";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppUrl();
  const [organizations, housing, opportunities] = await Promise.all([
    prisma.organization.findMany({
      where: organizationPublicVisibilityWhere,
      select: {
        slug: true,
        lastPublicUpdateAt: true,
        publishedAt: true,
        updatedAt: true,
      },
      orderBy: [{ lastPublicUpdateAt: "desc" }, { id: "asc" }],
      take: 5_000,
    }),
    prisma.housingListing.findMany({
      where: publicHousingListingWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 5_000,
    }),
    // Only PUBLISHED opportunities. publicOpportunityWhere defaults to the
    // ACTIVE scope, so drafts, pending, paused, closed, rejected, removed and
    // archived records are all excluded, and applications never appear.
    prisma.opportunity.findMany({
      where: publicOpportunityWhere(),
      select: { slug: true, updatedAt: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 5_000,
    }),
  ]);

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/organizations`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    ...organizations.map((organization) => ({
      url: `${baseUrl}/organizations/${organization.slug}`,
      lastModified:
        organization.lastPublicUpdateAt ??
        organization.publishedAt ??
        organization.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...housing.map((listing) => ({
      url: `${baseUrl}/housing/listings/${listing.slug}`,
      lastModified: listing.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
    {
      url: `${baseUrl}/opportunities`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    ...opportunities.map((opportunity) => ({
      url: `${baseUrl}/opportunities/${opportunity.slug}`,
      lastModified: opportunity.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.65,
    })),
  ];
}
