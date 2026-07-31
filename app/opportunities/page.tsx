import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityCard } from "@/components/features/opportunities/OpportunityCard";
import { listLegacyScholarshipCards } from "@/lib/opportunity-legacy-scholarships";
import { searchOpportunities } from "@/lib/opportunity-search";
import { getCurrentUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunities",
  description:
    "Scholarships, internships, jobs, research and programs for international students in China.",
};

const CATEGORIES = [
  { key: "", label: "All" },
  { key: "scholarships", label: "Scholarships" },
  { key: "internships", label: "Internships" },
  { key: "jobs", label: "Jobs" },
  { key: "research", label: "Research" },
  { key: "programs", label: "Programs" },
  { key: "volunteering", label: "Volunteering" },
];

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const [{ q = "", category = "" }, user] = await Promise.all([
    searchParams,
    getCurrentUser(),
  ]);

  const [results, legacy] = await Promise.all([
    searchOpportunities({
      query: q || null,
      category: category || null,
      viewerUserId: user?.id ?? null,
      limit: 18,
    }),
    // Legacy scholarships appear only on the unfiltered and scholarship views,
    // and are deduplicated against unified records by the adapter.
    category === "" || category === "scholarships"
      ? listLegacyScholarshipCards({ query: q || null, limit: 6 })
      : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-kondo-green">
        Opportunities
      </p>
      <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
        Scholarships, internships and jobs worth your time.
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Published by verified organizations and Kondo’s editorial team. Always
        confirm details on the official source before you apply.
      </p>

      <nav aria-label="Opportunity categories" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((entry) => {
            const active = entry.key === category;
            return (
              <li key={entry.key || "all"}>
                <Link
                  href={
                    entry.key
                      ? `/opportunities?category=${entry.key}`
                      : "/opportunities"
                  }
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex rounded-full px-4 py-2 text-sm font-bold transition ${
                    active
                      ? "bg-kondo-green text-white"
                      : "bg-black/5 text-foreground hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                  }`}
                >
                  {entry.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form className="mt-5" role="search">
        <label htmlFor="opportunity-search" className="sr-only">
          Search opportunities
        </label>
        <input
          id="opportunity-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search scholarships, internships, jobs…"
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-kondo-green dark:border-white/10 dark:bg-white/5"
        />
        {category ? (
          <input type="hidden" name="category" value={category} />
        ) : null}
      </form>

      {results.items.length === 0 && legacy.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          No opportunities match this search yet.
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.items.map((item) => (
            <li key={item.id}>
              <OpportunityCard item={item} />
            </li>
          ))}
          {legacy.map((item) => (
            <li key={item.id}>
              <article className="flex h-full flex-col rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                <span className="w-fit rounded-full bg-kondo-green/10 px-2.5 py-1 text-xs font-bold text-kondo-green">
                  {item.typeLabel}
                </span>
                <h3 className="mt-3 text-base font-black leading-snug tracking-[-0.02em]">
                  <Link href={item.href} className="hover:underline">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {item.summary}
                </p>
                <p className="mt-4 text-sm font-semibold">{item.provider}</p>
                <p className="text-sm text-muted-foreground">
                  {item.fundingLabel}
                  {item.location ? ` · ${item.location}` : ""}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
