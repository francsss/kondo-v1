import { prisma } from "@/lib/prisma";

async function main() {
  const [
    legacyScholarships,
    projectedScholarships,
    duplicateLegacyKeys,
    scholarshipAgents,
    organizationAliases,
    legacyJourneyUsers,
    marketplaceHousingCandidates,
  ] = await Promise.all([
    prisma.scholarship.count(),
    prisma.opportunity.count({
      where: { legacySourceKey: { startsWith: "legacy-scholarship:" } },
    }),
    prisma.opportunity.groupBy({
      by: ["legacySourceKey"],
      where: { legacySourceKey: { not: null } },
      _count: { _all: true },
      having: { legacySourceKey: { _count: { gt: 1 } } },
    }),
    prisma.scholarshipAgent.count(),
    prisma.organizationSlugAlias.count(),
    prisma.user.count({
      where: {
        onboardingCompletedAt: { not: null },
        studentJourney: { not: null },
        OR: [
          { journeyDetail: null },
          { journeyDetail: { journeyGroup: null } },
        ],
      },
    }),
    prisma.marketplaceListing.count({
      where: {
        OR: [
          { category: { name: { contains: "housing", mode: "insensitive" } } },
          { category: { name: { contains: "room", mode: "insensitive" } } },
        ],
      },
    }),
  ]);

  const result = {
    mode: "DRY_RUN_READ_ONLY",
    writesPerformed: 0,
    legacyScholarships,
    projectedScholarships,
    duplicateLegacyKeys: duplicateLegacyKeys.length,
    scholarshipAgents,
    organizationAliases,
    legacyJourneyUsersNeedingCompatibilityInference: legacyJourneyUsers,
    marketplaceHousingCandidates,
    decisions: {
      scholarships: "READ_ONLY_ADAPTER",
      scholarshipAgents: "INTENTIONALLY_RETAINED",
      organizationAliases: "REDIRECT_COMPATIBILITY",
      journey: "INFER_WITHOUT_DESTRUCTIVE_REWRITE",
      marketplaceHousing: "REVIEW_ONLY_NO_AUTOMATIC_MERGE",
    },
  };
  console.log(JSON.stringify(result, null, 2));
  if (duplicateLegacyKeys.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Legacy compatibility audit failed safely.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
