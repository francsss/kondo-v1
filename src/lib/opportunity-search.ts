import type { Prisma, StudyLevel } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import {
  opportunityCardSelect,
  serializeOpportunityCard,
} from "@/lib/opportunities";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import {
  isOpportunityCategory,
  isOpportunityType,
  opportunityTypesForCategory,
  type OpportunityCategory,
} from "@/lib/opportunity-types";
import { prisma } from "@/lib/prisma";

/**
 * Unified opportunity search.
 *
 * Results are bounded and cursor-paginated, filters map to indexed columns, and
 * ranking is deterministic. There is no popularity or engagement input: saves
 * and views never influence order, so no fabricated demand signal can appear.
 */

const MAX_PAGE_SIZE = 24;

export type OpportunitySearchFilters = {
  query?: string | null;
  category?: string | null;
  types?: readonly string[] | null;
  countryId?: string | null;
  cityId?: string | null;
  universityId?: string | null;
  workModes?: readonly string[] | null;
  degreeLevels?: readonly string[] | null;
  fieldsOfStudy?: readonly string[] | null;
  fundingTypes?: readonly string[] | null;
  employmentTypes?: readonly string[] | null;
  paidOnly?: boolean | null;
  languages?: readonly string[] | null;
  applicationMethods?: readonly string[] | null;
  verifiedOnly?: boolean | null;
  officialPartnerOnly?: boolean | null;
  deadlineBefore?: Date | null;
  savedByUserId?: string | null;
  cursor?: string | null;
  limit?: number | null;
};

function categoryTypes(category: string | null | undefined) {
  if (!category || !isOpportunityCategory(category)) return null;
  return opportunityTypesForCategory(category as OpportunityCategory);
}

export function buildOpportunitySearchWhere(
  filters: OpportunitySearchFilters,
  now = new Date(),
): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = {
    ...publicOpportunityWhere({ now }),
  };
  const and: Prisma.OpportunityWhereInput[] = [];

  const fromCategory = categoryTypes(filters.category);
  const explicitTypes = filters.types?.length
    ? filters.types.filter(isOpportunityType)
    : null;
  const types = explicitTypes?.length ? explicitTypes : fromCategory;
  if (types?.length) {
    and.push({ type: { in: [...types] } });
  }

  if (filters.countryId) and.push({ countryId: filters.countryId });
  if (filters.cityId) and.push({ cityId: filters.cityId });
  if (filters.universityId) and.push({ universityId: filters.universityId });
  if (filters.workModes?.length) {
    and.push({ workMode: { in: filters.workModes as never } });
  }
  if (filters.applicationMethods?.length) {
    and.push({
      applicationMethod: { in: filters.applicationMethods as never },
    });
  }
  if (filters.degreeLevels?.length) {
    and.push({
      degreeLevels: {
        some: { degreeLevel: { in: filters.degreeLevels as StudyLevel[] } },
      },
    });
  }
  if (filters.fieldsOfStudy?.length) {
    and.push({
      fieldsOfStudy: { some: { fieldKey: { in: [...filters.fieldsOfStudy] } } },
    });
  }
  if (filters.languages?.length) {
    and.push({
      languageRequirements: {
        some: { language: { in: [...filters.languages] } },
      },
    });
  }
  if (filters.fundingTypes?.length) {
    and.push({
      scholarshipDetail: { fundingType: { in: filters.fundingTypes as never } },
    });
  }
  if (filters.employmentTypes?.length) {
    and.push({
      jobDetail: { employmentType: { in: filters.employmentTypes as never } },
    });
  }
  if (filters.paidOnly) and.push({ jobDetail: { paid: true } });
  // Verification is an opt-in filter, never a silent default: unverified
  // publishers stay visible unless the viewer asks otherwise.
  if (filters.verifiedOnly) {
    and.push({
      publisherOrganization: { verificationStatus: "VERIFIED" },
    });
  }
  if (filters.officialPartnerOnly) {
    and.push({ publisherOrganization: { isOfficialPartner: true } });
  }
  if (filters.deadlineBefore) {
    and.push({ applicationDeadline: { lte: filters.deadlineBefore } });
  }
  if (filters.savedByUserId) {
    and.push({ savedBy: { some: { userId: filters.savedByUserId } } });
  }
  if (filters.query?.trim()) {
    const term = filters.query.trim().slice(0, 120);
    and.push({
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { shortDescription: { contains: term, mode: "insensitive" } },
        { locationLabel: { contains: term, mode: "insensitive" } },
        {
          publisherOrganization: {
            publicName: { contains: term, mode: "insensitive" },
          },
        },
        { university: { name: { contains: term, mode: "insensitive" } } },
      ],
    });
  }

  if (and.length) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...and];
  }
  return where;
}

export async function searchOpportunities(
  filters: OpportunitySearchFilters & { viewerUserId?: string | null },
  now = new Date(),
) {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit ?? 12));
  const where = buildOpportunitySearchWhere(filters, now);

  const rows = await prisma.opportunity.findMany({
    where,
    select: opportunityCardSelect,
    // Deterministic ordering: soonest real deadline first, then most recently
    // published, then id as a stable tie-breaker.
    orderBy: [
      { applicationDeadline: { sort: "asc", nulls: "last" } },
      { publishedAt: "desc" },
      { id: "asc" },
    ],
    take: limit + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  if (filters.query?.trim()) {
    await trackEvent({
      name: "OPPORTUNITY_SEARCH_STARTED",
      userId: filters.viewerUserId ?? undefined,
      properties: { category: filters.category ?? "all" },
    });
  }

  return {
    items: page.map((row) => serializeOpportunityCard(row, now)),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
  };
}

export async function countOpportunitiesByCategory(now = new Date()) {
  const rows = await prisma.opportunity.groupBy({
    by: ["type"],
    where: publicOpportunityWhere({ now }),
    _count: { _all: true },
  });
  return rows.map((row) => ({ type: row.type, count: row._count._all }));
}
