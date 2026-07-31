import type { Metadata } from "next";
import Link from "next/link";
import { LegacyScholarshipCard } from "@/components/features/student-hub/LegacyScholarshipCard";
import { StudentHubOpportunitySection } from "@/components/features/student-hub/StudentHubOpportunitySection";
import { StudentHubSectionHeader } from "@/components/features/student-hub/StudentHubSectionHeader";
import { listLegacyScholarshipCards } from "@/lib/opportunity-legacy-scholarships";
import { requireUser } from "@/lib/server-auth";
import { studentHubSection } from "@/lib/student-hub-sections";

const section = studentHubSection("scholarships");

export const metadata: Metadata = {
  title: section.title,
  description: section.description,
};

/**
 * One unified Scholarships experience.
 *
 * Results come from unified Opportunity records and from the legacy Scholarship
 * table, presented identically. The former public "Opportunities /
 * Scholarship agents" tab split is gone: a student looking for funding should
 * not have to pick which of Kondo's internal storage models to search, and an
 * adviser directory is support, not a second catalogue of scholarships.
 *
 * Deduplication is handled by the compatibility adapter, which suppresses any
 * legacy row already claimed by a unified record through `legacySourceKey`.
 */
export default async function StudentHubScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);

  // Legacy records answer the free-text query only; the structured opportunity
  // filters do not exist on the legacy table, so applying one narrows the view
  // to unified records rather than silently ignoring the filter.
  const structurallyFiltered = [
    "countryId",
    "cityId",
    "universityId",
    "workMode",
    "degreeLevel",
    "funding",
    "applicationMethod",
    "paid",
    "verified",
    "partner",
    "deadlineDays",
    "saved",
  ].some((key) => Boolean(params[key]));

  const legacy = structurallyFiltered
    ? []
    : await listLegacyScholarshipCards({ query: params.q || null, limit: 24 });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <StudentHubSectionHeader sectionKey="scholarships" />

      <StudentHubOpportunitySection
        extraResults={
          legacy.length
            ? legacy.map((item) => (
                <li key={item.id}>
                  <LegacyScholarshipCard item={item} />
                </li>
              ))
            : undefined
        }
        params={params}
        sectionKey="scholarships"
        viewerUserId={user.id}
      />

      {/* Adviser support stays reachable without becoming a second public tab
          competing with the scholarships themselves. */}
      <aside className="mt-10 rounded-3xl border border-border bg-card p-6">
        <h2 className="text-lg font-black">Need help with an application?</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Independent advisers listed on Kondo can support your application.
          Verification confirms profile checks, not admission outcomes — never
          pay for a guaranteed scholarship.
        </p>
        <Link
          className="mt-4 inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-black text-secondary-foreground transition hover:bg-secondary/75"
          href="/student-hub/scholarships/agents"
        >
          Browse scholarship advisers
        </Link>
      </aside>
    </div>
  );
}
