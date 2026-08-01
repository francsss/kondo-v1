import {
  activeListingWhere,
  communityVisibilityWhere,
  publishedPostVisibilityWhere,
} from "@/lib/content-visibility";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { listPublicCatalog } from "@/lib/organization-catalog";
import { organizationPublicVisibilityWhere } from "@/lib/organization-public-visibility";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";
import type {
  DiscoverContext,
  DiscoverFilters,
  DiscoverProvider,
  DiscoverResourceType,
} from "@/features/discover/types";

function take(filters: DiscoverFilters) {
  return Math.min(24, Math.max(1, filters.limit ?? 8));
}

function nearReason(
  context: DiscoverContext,
  cityId: string | null | undefined,
  universityId?: string | null,
) {
  if (context.universityId && universityId === context.universityId) {
    return "Connected to your university";
  }
  if (context.cityId && cityId === context.cityId) return "Near your city";
  return null;
}

const organizations: DiscoverProvider = {
  key: "organizations",
  label: "Organizations",
  description: "Trusted universities, companies and student services.",
  cacheTags: ["organizations:public"],
  analyticsSource: "organization-public-profile",
  async search(context, filters) {
    const rows = await prisma.organization.findMany({
      where: {
        ...organizationPublicVisibilityWhere,
        cityId: filters.cityId,
        ...(filters.query
          ? {
              OR: [
                {
                  publicName: { contains: filters.query, mode: "insensitive" },
                },
                { tagline: { contains: filters.query, mode: "insensitive" } },
                {
                  shortDescription: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        publicName: true,
        tagline: true,
        shortDescription: true,
        type: true,
        logoMediaId: true,
        verificationStatus: true,
        isOfficialPartner: true,
        cityId: true,
        city: { select: { name: true } },
      },
      orderBy: [
        ...(context.cityId ? [{ cityId: "desc" as const }] : []),
        { verificationStatus: "desc" },
        { isOfficialPartner: "desc" },
        { lastPublicUpdateAt: "desc" },
      ],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "organizations" as const,
      title: row.publicName,
      description: row.shortDescription ?? row.tagline,
      href: `/organizations/${row.slug}`,
      eyebrow:
        row.verificationStatus === "VERIFIED"
          ? "Verified organization"
          : "Organization",
      location: row.city?.name ?? null,
      imageUrl: row.logoMediaId ? `/api/media/${row.logoMediaId}` : null,
      metadata: [row.type.replaceAll("_", " ").toLowerCase()],
      recommendationReason: nearReason(context, row.cityId),
      analytics: {
        resourceType: "organizations" as const,
        sourceDomain: "organizations",
      },
    }));
  },
};

const housing: DiscoverProvider = {
  key: "housing",
  label: "Housing",
  description: "Published homes with privacy-safe locations.",
  cacheTags: ["housing:public"],
  analyticsSource: "housing",
  async search(context, filters) {
    const rows = await prisma.housingListing.findMany({
      where: {
        ...publicHousingListingWhere(),
        cityId: filters.cityId,
        universityId: filters.universityId,
        ...(filters.query
          ? {
              OR: [
                { title: { contains: filters.query, mode: "insensitive" } },
                {
                  shortDescription: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
                {
                  publicLocationLabel: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        publicLocationLabel: true,
        cityId: true,
        universityId: true,
        monthlyRentMinor: true,
        currency: true,
        type: true,
        media: {
          where: { media: { status: "ACTIVE", scanStatus: "CLEAN" } },
          select: { mediaId: true },
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "housing" as const,
      title: row.title,
      description: row.shortDescription,
      href: `/housing/listings/${row.id}`,
      eyebrow: "Housing",
      location: row.publicLocationLabel,
      imageUrl: row.media[0]?.mediaId
        ? `/api/media/${row.media[0].mediaId}`
        : null,
      metadata: [
        row.type.replaceAll("_", " ").toLowerCase(),
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: row.currency,
          maximumFractionDigits: 0,
        }).format(row.monthlyRentMinor / 100),
      ],
      recommendationReason: nearReason(context, row.cityId, row.universityId),
      analytics: { resourceType: "housing" as const, sourceDomain: "housing" },
    }));
  },
};

const opportunities: DiscoverProvider = {
  key: "opportunities",
  label: "Opportunities",
  description: "Scholarships, internships, jobs and programs.",
  cacheTags: ["opportunities:public"],
  analyticsSource: "opportunities",
  async search(context, filters) {
    const rows = await prisma.opportunity.findMany({
      where: {
        ...publicOpportunityWhere(),
        cityId: filters.cityId,
        universityId: filters.universityId,
        ...(filters.query
          ? {
              OR: [
                { title: { contains: filters.query, mode: "insensitive" } },
                {
                  shortDescription: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
                {
                  locationLabel: {
                    contains: filters.query,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        type: true,
        cityId: true,
        universityId: true,
        locationLabel: true,
        applicationDeadline: true,
        publisherOrganization: { select: { publicName: true } },
        media: {
          where: {
            isCover: true,
            media: { status: "ACTIVE", scanStatus: "CLEAN" },
          },
          select: { mediaId: true },
          take: 1,
        },
      },
      orderBy: [
        { applicationDeadline: { sort: "asc", nulls: "last" } },
        { publishedAt: "desc" },
      ],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "opportunities" as const,
      title: row.title,
      description: row.shortDescription,
      href: `/opportunities/${row.slug}`,
      eyebrow: row.type.replaceAll("_", " ").toLowerCase(),
      location: row.locationLabel,
      imageUrl: row.media[0]?.mediaId
        ? `/api/media/${row.media[0].mediaId}`
        : null,
      metadata: [
        row.publisherOrganization?.publicName ?? "Kondo opportunity",
        ...(row.applicationDeadline
          ? [`Deadline ${row.applicationDeadline.toLocaleDateString("en")}`]
          : []),
      ],
      recommendationReason: nearReason(context, row.cityId, row.universityId),
      analytics: {
        resourceType: "opportunities" as const,
        sourceDomain: "opportunities",
      },
    }));
  },
};

function catalogProvider(kind: "product" | "service"): DiscoverProvider {
  const key = kind === "product" ? "products" : "services";
  return {
    key,
    label: kind === "product" ? "Products" : "Services",
    description:
      kind === "product"
        ? "Professional products from active organizations."
        : "Practical student services from active organizations.",
    cacheTags: [`catalog:${kind}:public`],
    analyticsSource: `organization-${kind}`,
    async search(context, filters) {
      const rows = await listPublicCatalog({
        kind,
        query: filters.query,
        cityId: filters.cityId,
        limit: take(filters),
      });
      return rows.map((row) => ({
        id: row.id,
        type: key,
        title: row.title,
        description: row.shortDescription,
        href: row.href,
        eyebrow: `Organization ${kind}`,
        location: row.locationLabel ?? row.city?.name ?? null,
        imageUrl: row.media[0]?.url ?? row.organization.logoUrl,
        metadata: [row.priceLabel, row.organization.name],
        recommendationReason: nearReason(context, row.city?.id),
        analytics: { resourceType: key, sourceDomain: `organization-${kind}` },
      }));
    },
  };
}

const marketplace: DiscoverProvider = {
  key: "marketplace",
  label: "Marketplace",
  description: "Peer-to-peer listings from students and individual sellers.",
  cacheTags: ["marketplace:public"],
  analyticsSource: "peer-marketplace",
  async search(context, filters) {
    const rows = await prisma.marketplaceListing.findMany({
      where: {
        ...activeListingWhere(),
        cityId: filters.cityId,
        ...(filters.query
          ? {
              OR: [
                { title: { contains: filters.query, mode: "insensitive" } },
                {
                  description: { contains: filters.query, mode: "insensitive" },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        priceFen: true,
        cityId: true,
        city: { select: { name: true } },
        category: { select: { name: true } },
        images: {
          where: { mediaId: { not: null } },
          select: { mediaId: true },
          orderBy: { order: "asc" },
          take: 1,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "marketplace" as const,
      title: row.title,
      description: row.description,
      href: `/marketplace/${row.slug}`,
      eyebrow: "Peer marketplace",
      location: row.city.name,
      imageUrl: row.images[0]?.mediaId
        ? `/api/media/${row.images[0].mediaId}`
        : null,
      metadata: [
        row.category.name,
        `¥${(row.priceFen / 100).toFixed(row.priceFen % 100 ? 2 : 0)}`,
      ],
      recommendationReason: nearReason(context, row.cityId),
      analytics: {
        resourceType: "marketplace" as const,
        sourceDomain: "peer-marketplace",
      },
    }));
  },
};

/**
 * Student Skills, read from `StudentSkillOffer`. Discover aggregates the source
 * domain directly — no record is copied into a Discover table, and a student
 * skill is never presented as an organization service.
 */
const studentSkills: DiscoverProvider = {
  key: "skills",
  label: "Student Skills",
  description: "Skills and small services offered directly by students.",
  cacheTags: ["marketplace:public"],
  analyticsSource: "student-skill",
  async search(context, filters) {
    const rows = await prisma.studentSkillOffer.findMany({
      where: {
        status: "ACTIVE",
        expiresAt: { gt: new Date() },
        owner: { status: "ACTIVE" },
        cityId: filters.cityId,
        ...(filters.query
          ? {
              OR: [
                { title: { contains: filters.query, mode: "insensitive" } },
                { category: { contains: filters.query, mode: "insensitive" } },
                {
                  description: { contains: filters.query, mode: "insensitive" },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        title: true,
        category: true,
        description: true,
        availability: true,
        cityId: true,
        city: { select: { name: true } },
        // First name only: a public skill card never exposes a full identity.
        owner: { select: { firstName: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "skills" as const,
      title: row.title,
      description: row.description,
      href: "/marketplace?view=skills",
      eyebrow: "Student skill",
      location: row.city?.name ?? null,
      imageUrl: null,
      metadata: [row.category, row.owner.firstName].filter(
        (value): value is string => Boolean(value),
      ),
      recommendationReason: nearReason(context, row.cityId),
      analytics: {
        resourceType: "skills" as const,
        sourceDomain: "student-skill",
      },
    }));
  },
};

const communities: DiscoverProvider = {
  key: "communities",
  label: "Communities",
  description: "Relevant spaces you can safely discover or join.",
  cacheTags: ["communities:visible"],
  analyticsSource: "communities",
  async search(context, filters) {
    const rows = await prisma.community.findMany({
      where: {
        AND: [
          communityVisibilityWhere({ id: context.viewerId }),
          {
            status: "ACTIVE",
            cityId: filters.cityId,
            universityId: filters.universityId,
            ...(filters.query
              ? {
                  OR: [
                    { name: { contains: filters.query, mode: "insensitive" } },
                    {
                      description: {
                        contains: filters.query,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
        ],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        icon: true,
        type: true,
        cityId: true,
        universityId: true,
        city: { select: { name: true } },
        _count: { select: { members: true } },
      },
      orderBy: [{ members: { _count: "desc" } }, { name: "asc" }],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "communities" as const,
      title: `${row.icon ? `${row.icon} ` : ""}${row.name}`,
      description: row.description,
      href: `/communities/${row.slug}`,
      eyebrow: `${row.type.toLowerCase()} community`,
      location: row.city?.name ?? null,
      imageUrl: null,
      metadata: [`${row._count.members} members`],
      recommendationReason: nearReason(context, row.cityId, row.universityId),
      analytics: {
        resourceType: "communities" as const,
        sourceDomain: "communities",
      },
    }));
  },
};

const universities: DiscoverProvider = {
  key: "universities",
  label: "Universities",
  description: "Active university reference records across Kondo.",
  cacheTags: ["reference:universities"],
  analyticsSource: "reference-data",
  async search(context, filters) {
    const rows = await prisma.university.findMany({
      where: {
        isActive: true,
        id: filters.universityId,
        cityId: filters.cityId,
        ...(filters.query
          ? {
              OR: [
                { name: { contains: filters.query, mode: "insensitive" } },
                { shortName: { contains: filters.query, mode: "insensitive" } },
                {
                  city: {
                    name: { contains: filters.query, mode: "insensitive" },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        verified: true,
        cityId: true,
        city: { select: { name: true, slug: true } },
      },
      orderBy: [{ verified: "desc" }, { name: "asc" }],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "universities" as const,
      title: row.name,
      description: row.shortName,
      href: `/communities?tab=discover&q=${encodeURIComponent(row.name)}`,
      eyebrow: row.verified ? "Verified university" : "University",
      location: row.city.name,
      imageUrl: null,
      metadata: [],
      recommendationReason: nearReason(context, row.cityId, row.id),
      analytics: {
        resourceType: "universities" as const,
        sourceDomain: "reference-data",
      },
    }));
  },
};

const cities: DiscoverProvider = {
  key: "cities",
  label: "Cities",
  description: "Student city hubs built from real activity and public content.",
  cacheTags: ["cities:active", "city-hubs:published"],
  analyticsSource: "city-hub",
  async search(context, filters) {
    const rows = await prisma.city.findMany({
      where: {
        isActive: true,
        id: filters.cityId,
        OR: [
          { cityHub: { status: "PUBLISHED" } },
          { users: { some: { status: "ACTIVE" } } },
        ],
        ...(filters.query
          ? {
              AND: {
                OR: [
                  { name: { contains: filters.query, mode: "insensitive" } },
                  {
                    province: { contains: filters.query, mode: "insensitive" },
                  },
                ],
              },
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        province: true,
        verified: true,
        _count: { select: { users: { where: { status: "ACTIVE" } } } },
      },
      orderBy: [
        { verified: "desc" },
        { users: { _count: "desc" } },
        { name: "asc" },
      ],
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "cities" as const,
      title: row.name,
      description: row.province,
      href: `/discover/cities/${row.slug}`,
      eyebrow: "City hub",
      location: row.province,
      imageUrl: null,
      metadata: [`${row._count.users} students`],
      recommendationReason: context.cityId === row.id ? "Your city" : null,
      analytics: { resourceType: "cities" as const, sourceDomain: "city-hub" },
    }));
  },
};

const events: DiscoverProvider = {
  key: "events",
  label: "Events",
  description: "Upcoming validated events from visible communities.",
  cacheTags: ["community-events:public"],
  analyticsSource: "community-events",
  async search(context, filters) {
    const rows = await prisma.post.findMany({
      where: {
        AND: [
          publishedPostVisibilityWhere({ id: context.viewerId }),
          {
            status: "PUBLISHED",
            type: "EVENT",
            eventValidatedAt: { not: null },
            eventAt: { gte: new Date() },
            community: {
              cityId: filters.cityId,
              universityId: filters.universityId,
            },
            ...(filters.query
              ? {
                  OR: [
                    { title: { contains: filters.query, mode: "insensitive" } },
                    {
                      content: { contains: filters.query, mode: "insensitive" },
                    },
                    {
                      eventLocation: {
                        contains: filters.query,
                        mode: "insensitive",
                      },
                    },
                  ],
                }
              : {}),
          },
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        eventAt: true,
        eventLocation: true,
        community: {
          select: { slug: true, name: true, cityId: true, universityId: true },
        },
      },
      orderBy: { eventAt: "asc" },
      take: take(filters),
    });
    return rows.map((row) => ({
      id: row.id,
      type: "events" as const,
      title: row.title ?? row.content.slice(0, 100),
      description: row.content,
      href: `/communities/${row.community.slug}?post=${row.id}`,
      eyebrow: "Event",
      location: row.eventLocation,
      imageUrl: null,
      metadata: [
        row.community.name,
        ...(row.eventAt ? [row.eventAt.toLocaleDateString("en")] : []),
      ],
      recommendationReason: nearReason(
        context,
        row.community.cityId,
        row.community.universityId,
      ),
      analytics: {
        resourceType: "events" as const,
        sourceDomain: "community-events",
      },
    }));
  },
};

export const DISCOVER_PROVIDERS = [
  organizations,
  housing,
  opportunities,
  catalogProvider("product"),
  catalogProvider("service"),
  marketplace,
  studentSkills,
  communities,
  universities,
  cities,
  events,
] as const satisfies readonly DiscoverProvider[];

export function discoverProvider(type: DiscoverResourceType) {
  return DISCOVER_PROVIDERS.find((provider) => provider.key === type)!;
}
