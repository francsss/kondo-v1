import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ClampedTitle, ExpandableText } from "@/components/ui/ClampedText";
import type { LegacyScholarshipCard as LegacyScholarship } from "@/lib/opportunity-legacy-scholarships";

/**
 * A legacy Scholarship record presented exactly like a unified opportunity.
 *
 * Students should never be asked to understand that Kondo holds scholarships in
 * two tables, so the card states the real publisher and nothing about the
 * persistence model. The record itself is untouched and keeps its canonical
 * legacy URL.
 */
export function LegacyScholarshipCard({ item }: { item: LegacyScholarship }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-white/5">
      <Link
        className="relative block aspect-[16/8] overflow-hidden bg-kondo-green/5"
        href={item.href}
      >
        <span className="grid h-full place-items-center text-kondo-green/60">
          <GraduationCap aria-hidden="true" className="h-9 w-9" />
        </span>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-kondo-green/10 px-2.5 py-1 text-xs font-bold text-kondo-green">
            {item.typeLabel}
          </span>
        </div>

        <h3 className="mt-3 text-base font-black leading-snug tracking-[-0.02em]">
          <Link className="hover:underline" href={item.href}>
            <ClampedTitle>{item.title}</ClampedTitle>
          </Link>
        </h3>

        <ExpandableText
          className="mt-1.5 text-sm leading-6 text-muted-foreground"
          lines={4}
          text={item.summary}
        />

        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="sr-only">Publisher</dt>
            <dd className="font-semibold">Published by {item.provider}</dd>
          </div>
          {item.location ? (
            <div className="flex gap-2 text-muted-foreground">
              <dt className="sr-only">Location</dt>
              <dd>{item.location}</dd>
            </div>
          ) : null}
          <div className="flex gap-2 text-muted-foreground">
            <dt className="sr-only">Funding</dt>
            <dd>{item.fundingLabel}</dd>
          </div>
        </dl>

        {item.deadline ? (
          <p className="mt-4 border-t border-black/5 pt-3 text-xs font-semibold text-muted-foreground dark:border-white/10">
            Deadline:{" "}
            {new Date(item.deadline).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>
    </article>
  );
}
