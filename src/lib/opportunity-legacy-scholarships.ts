import { canExposeLegacyScholarship } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";

/**
 * ScholarshipAgent / Scholarship compatibility adapter.
 *
 * The legacy Scholarship and ScholarshipAgent tables remain untouched and
 * authoritative for the records they hold: the existing Student Hub directory
 * keeps reading them directly, and nothing here rewrites, copies or reassigns
 * them. This module only projects them into the unified opportunity surfaces in
 * a read-only shape.
 *
 * Deduplication: an Opportunity that was created from a legacy record carries
 * `legacySourceKey`. Any legacy row whose signature matches a live
 * `legacySourceKey` is suppressed here, so a source can never appear twice in
 * one result set. Migration of legacy rows into the Opportunity domain is
 * deliberately deferred — see docs/PROJECT_FEATURE_MAP.md.
 */

export function legacyScholarshipSourceKey(input: { id: string }): string {
  return `legacy-scholarship:${input.id}`;
}

export type LegacyScholarshipCard = {
  id: string;
  source: "LEGACY_SCHOLARSHIP";
  title: string;
  summary: string;
  href: string;
  provider: string;
  location: string | null;
  fundingLabel: string;
  deadline: string | null;
  typeLabel: string;
};

function fundingLabel(fundingType: string) {
  return fundingType === "FULL" ? "Fully funded" : "Partially funded";
}

/**
 * Legacy scholarships shown alongside Opportunity records. Returns a distinct
 * shape rather than pretending to be an Opportunity, so callers cannot
 * accidentally treat a legacy row as one that supports Kondo applications.
 */
export async function listLegacyScholarshipCards(input: {
  query?: string | null;
  limit?: number;
}): Promise<LegacyScholarshipCard[]> {
  const limit = Math.min(24, Math.max(1, input.limit ?? 12));
  const term = input.query?.trim();

  const rows = await prisma.scholarship.findMany({
    where: {
      isActive: true,
      status: { not: "CLOSED" },
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: "insensitive" } },
              { provider: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      slug: true,
      title: true,
      provider: true,
      city: true,
      description: true,
      fundingType: true,
      status: true,
      isActive: true,
      deadline: true,
      country: { select: { name: true } },
    },
    orderBy: [{ isFeatured: "desc" }, { deadline: "asc" }, { id: "asc" }],
    take: limit,
  });

  // Suppress any legacy row that already has a live unified counterpart.
  const claimed = new Set(
    (
      await prisma.opportunity.findMany({
        where: {
          legacySourceKey: {
            in: rows.map((row) => legacyScholarshipSourceKey({ id: row.id })),
          },
          lifecycle: { notIn: ["REMOVED", "ARCHIVED"] },
        },
        select: { legacySourceKey: true },
      })
    ).flatMap((row) => (row.legacySourceKey ? [row.legacySourceKey] : [])),
  );

  return rows
    .filter(
      (row) =>
        canExposeLegacyScholarship({
          isActive: row.isActive,
          status: row.status,
        }) && !claimed.has(legacyScholarshipSourceKey({ id: row.id })),
    )
    .map((row) => ({
      id: row.id,
      source: "LEGACY_SCHOLARSHIP" as const,
      title: row.title,
      summary: row.description.slice(0, 240),
      // The legacy directory keeps its own canonical URL; no duplicate public
      // scholarship URL is created under /opportunities.
      href: `/student-hub/scholarships/${row.slug}`,
      provider: row.provider,
      location:
        [row.city, row.country?.name].filter(Boolean).join(", ") || null,
      fundingLabel: fundingLabel(row.fundingType),
      deadline: row.deadline?.toISOString().slice(0, 10) ?? null,
      typeLabel: "Scholarship",
    }));
}

export async function countLegacyScholarships() {
  return prisma.scholarship.count({
    where: { isActive: true, status: { not: "CLOSED" } },
  });
}
