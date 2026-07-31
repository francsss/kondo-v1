import { OpportunityCard } from "@/components/features/opportunities/OpportunityCard";
import { OpportunityFilters } from "@/components/features/opportunities/OpportunityFilters";
import { searchOpportunities } from "@/lib/opportunity-search";
import { publicOpportunityWhere } from "@/lib/opportunity-visibility";
import { prisma } from "@/lib/prisma";
import {
  studentHubSection,
  studentHubSectionTypes,
  type StudentHubSectionKey,
} from "@/lib/student-hub-sections";

/**
 * One Student Hub category, rendered as a filtered projection of the central
 * Opportunity domain.
 *
 * The section owns its own title, filters, empty state and result set, so a
 * student who selects Internships never lands on something that reads as a
 * generic mixed directory. The persistence model stays invisible to them.
 */

function deadlineFromDays(value: string | undefined) {
  return ["7", "30", "90"].includes(value ?? "")
    ? new Date(Date.now() + Number(value) * 86_400_000)
    : null;
}

export type StudentHubSearchParams = Record<string, string | undefined>;

export async function StudentHubOpportunitySection({
  sectionKey,
  params,
  viewerUserId,
  extraResults,
}: {
  sectionKey: StudentHubSectionKey;
  params: StudentHubSearchParams;
  viewerUserId: string | null;
  /** Additional cards merged into the grid, e.g. legacy scholarships. */
  extraResults?: React.ReactNode;
}) {
  const section = studentHubSection(sectionKey);
  const types = studentHubSectionTypes(sectionKey);

  const [results, optionRows] = await Promise.all([
    searchOpportunities({
      query: params.q || null,
      types,
      countryId: params.countryId || null,
      cityId: params.cityId || null,
      universityId: params.universityId || null,
      workModes: params.workMode ? [params.workMode] : null,
      degreeLevels: params.degreeLevel ? [params.degreeLevel] : null,
      fundingTypes: params.funding ? [params.funding] : null,
      applicationMethods: params.applicationMethod
        ? [params.applicationMethod]
        : null,
      paidOnly: params.paid === "true",
      verifiedOnly: params.verified === "true",
      officialPartnerOnly: params.partner === "true",
      deadlineBefore: deadlineFromDays(params.deadlineDays),
      savedByUserId: params.saved === "true" ? viewerUserId : null,
      viewerUserId,
      limit: 18,
    }),
    // Filter options are restricted to the section's own types so a student is
    // never offered a city that exists only for a category they are not in.
    prisma.opportunity.findMany({
      where: { ...publicOpportunityWhere(), type: { in: types as never } },
      select: {
        country: { select: { id: true, name: true } },
        city: { select: { id: true, name: true } },
        university: { select: { id: true, name: true } },
      },
      take: 500,
    }),
  ]);

  const uniqueOptions = (values: Array<{ id: string; name: string } | null>) =>
    [
      ...new Map(
        values.filter(Boolean).map((item) => [item!.id, item!]),
      ).values(),
    ].sort((a, b) => a.name.localeCompare(b.name));

  const empty = results.items.length === 0 && !extraResults;

  return (
    <>
      <OpportunityFilters
        cities={uniqueOptions(optionRows.map((row) => row.city))}
        countries={uniqueOptions(optionRows.map((row) => row.country))}
        universities={uniqueOptions(optionRows.map((row) => row.university))}
      />

      {empty ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-10 text-center">
          <h2 className="text-lg font-black">{section.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {section.emptyBody}
          </p>
          <a
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-black text-secondary-foreground transition hover:bg-secondary/75"
            href={section.href}
          >
            Reset filters
          </a>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.items.map((item) => (
            <li key={item.id}>
              <OpportunityCard item={item} />
            </li>
          ))}
          {extraResults}
        </ul>
      )}
    </>
  );
}
