import Link from "next/link";
import { OpportunityCard } from "@/components/features/opportunities/OpportunityCard";
import type { OpportunityRail } from "@/lib/opportunity-recommendations";

/**
 * Student Hub opportunity rails. Each rail renders the explanation the service
 * produced, so a recommendation is never shown without its reason, and no
 * numeric score is displayed.
 */
export function OpportunityRails({ rails }: { rails: OpportunityRail[] }) {
  if (rails.length === 0) return null;
  return (
    <>
      {rails.map((rail) => (
        <section
          key={rail.key}
          aria-labelledby={`rail-${rail.key}`}
          className="mt-10"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id={`rail-${rail.key}`}
              className="text-lg font-black tracking-[-0.02em]"
            >
              {rail.title}
            </h2>
            <Link
              href={rail.href}
              className="text-sm font-bold text-kondo-green hover:underline"
            >
              See all
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {rail.explanation}
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rail.items.map((item) => (
              <li key={item.id}>
                <OpportunityCard item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
