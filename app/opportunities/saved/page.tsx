import type { Metadata } from "next";
import Link from "next/link";
import { OpportunityCard } from "@/components/features/opportunities/OpportunityCard";
import { listSavedOpportunities } from "@/lib/opportunity-saved";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Saved opportunities" };
// Private to one user: never statically cached.
export const dynamic = "force-dynamic";

export default async function SavedOpportunitiesPage() {
  const user = await requireUser();
  const saved = await listSavedOpportunities({ userId: user.id });

  return (
    <div className="mx-auto max-w-[1240px] px-4 pb-20 pt-8 sm:px-6 lg:px-8 lg:pt-12">
      <h1 className="text-3xl font-black tracking-[-0.04em]">
        Saved opportunities
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Only you can see this list. Publishers are never shown who saved an
        opportunity.
      </p>

      {saved.length === 0 ? (
        <p className="mt-10 rounded-3xl border border-dashed border-black/10 p-8 text-center text-sm text-muted-foreground dark:border-white/15">
          Nothing saved yet.{" "}
          <Link href="/opportunities" className="font-bold underline">
            Browse opportunities
          </Link>
        </p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((entry) =>
            entry.opportunity ? (
              <li key={entry.opportunity.id}>
                <OpportunityCard item={entry.opportunity} />
              </li>
            ) : (
              // Visibility is re-checked on read, so a removed or suspended
              // opportunity shows a safe state instead of leaking anything.
              <li
                key={entry.unavailableTitle ?? entry.savedAt}
                className="rounded-3xl border border-dashed border-black/10 p-5 text-sm text-muted-foreground dark:border-white/15"
              >
                <p className="font-semibold">{entry.unavailableTitle}</p>
                <p className="mt-1">This opportunity is no longer available.</p>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
