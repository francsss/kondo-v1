import type { OpportunityType } from "@prisma/client";
import type { OrganizationPublicProjection } from "@/features/organizations/public-sections";
import {
  opportunityCardSelect,
  serializeOpportunityCard,
} from "@/lib/opportunities";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { opportunityTypesForCategory } from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";

/**
 * Projections of the Opportunity domain into other surfaces.
 *
 * Opportunity remains the source of truth: nothing here copies an opportunity
 * record into organization JSON or a Student Hub snapshot. Every projection is
 * a bounded, live query behind the same public visibility rule, so removing an
 * opportunity or suspending its organization removes it everywhere at once.
 */

const FEATURED_LIMIT = 4;

async function organizationProjectionForTypes(
  organizationId: string,
  types: readonly OpportunityType[],
  sectionRoute: string,
): Promise<OrganizationPublicProjection> {
  const where = {
    publisherOrganizationId: organizationId,
    type: { in: [...types] },
    ...publicOpportunityWhere(),
  };
  const [rows, itemCount] = await Promise.all([
    prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        locationLabel: true,
        city: { select: { name: true } },
        country: { select: { name: true } },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: FEATURED_LIMIT,
    }),
    prisma.opportunity.count({ where }),
  ]);

  return {
    available: itemCount > 0,
    itemCount,
    featuredItems: rows.map((row) => ({
      id: row.id,
      title: row.title,
      href: `/opportunities/${row.slug}`,
      context:
        row.locationLabel ??
        [row.city?.name, row.country?.name].filter(Boolean).join(", ") ??
        null,
    })),
    // A section only links somewhere when it actually has content.
    sectionRoute: itemCount > 0 ? sectionRoute : null,
    visibility: itemCount > 0 ? "PUBLIC" : "HIDDEN",
  };
}

export function getOrganizationScholarshipProjection(organizationId: string) {
  return organizationProjectionForTypes(
    organizationId,
    opportunityTypesForCategory("scholarships"),
    `/opportunities/scholarships?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export function getOrganizationJobsProjection(organizationId: string) {
  return organizationProjectionForTypes(
    organizationId,
    [
      ...opportunityTypesForCategory("internships"),
      ...opportunityTypesForCategory("jobs"),
      ...opportunityTypesForCategory("research"),
    ],
    `/opportunities/jobs?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

export function getOrganizationProgramsProjection(organizationId: string) {
  return organizationProjectionForTypes(
    organizationId,
    [
      ...opportunityTypesForCategory("programs"),
      ...opportunityTypesForCategory("volunteering"),
    ],
    `/opportunities/programs?organizationId=${encodeURIComponent(organizationId)}`,
  );
}

/** Bounded city rail used by Explore. */
export async function getCityOpportunityProjection(cityId: string, limit = 6) {
  const rows = await prisma.opportunity.findMany({
    where: { cityId, ...publicOpportunityWhere() },
    select: opportunityCardSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: Math.min(12, Math.max(1, limit)),
  });
  return rows.map((row) => serializeOpportunityCard(row));
}
