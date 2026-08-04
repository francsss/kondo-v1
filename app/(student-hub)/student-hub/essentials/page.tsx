import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Package, Receipt, Sparkles } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { HorizontalTabs } from "@/components/ui/HorizontalTabs";
import { requireUser } from "@/lib/server-auth";
import {
  countStudyEssentialsByFilter,
  formatEssentialPrice,
  isStudyEssentialFilter,
  listStudyEssentials,
  STUDY_ESSENTIAL_FILTERS,
  type StudyEssentialFilterKey,
} from "@/lib/study-essentials";

export const metadata: Metadata = {
  title: "Study Essentials — Student Hub",
  description:
    "A curated academic catalogue from Kondo and its partners: guides, language material and the physical essentials of student life in China.",
};

export const dynamic = "force-dynamic";

export default async function StudyEssentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser();
  const requested = (await searchParams).filter;
  const filter: StudyEssentialFilterKey = isStudyEssentialFilter(requested)
    ? requested
    : "all";
  const [items, counts] = await Promise.all([
    listStudyEssentials(filter),
    countStudyEssentialsByFilter(),
  ]);

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="max-w-3xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-kondo-mint px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          Curated by Kondo
        </p>
        <h1 className="mt-4 text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
          Everything you need to study well.
        </h1>
        <p className="mt-3 text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
          A short, chosen catalogue rather than a marketplace — the guides,
          language material and physical essentials that international students
          in China actually use, plus a few things our partners do better than
          we would.
        </p>
      </header>


      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <HorizontalTabs
          activeKey={filter}
          ariaLabel="Filter Study Essentials"
          tabs={STUDY_ESSENTIAL_FILTERS.map(({ key, label }) => ({
            key,
            label,
            href:
              key === "all"
                ? "/student-hub/essentials"
                : `/student-hub/essentials?filter=${key}`,
            badge: (
              <span className="text-xs font-bold tabular-nums opacity-60">
                {counts[key]}
              </span>
            ),
          }))}
        />
        <Link
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
          href="/student-hub/orders"
        >
          <Receipt aria-hidden="true" className="h-4 w-4" />
          Your orders
        </Link>
      </div>

      {items.length ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const price = formatEssentialPrice(item.priceMinor, item.currency);
            return (
              <li className="min-w-0" key={item.id}>
                <Link
                  className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-card transition hover:-translate-y-0.5 hover:border-kondo-green/50 hover:shadow-lift motion-reduce:transform-none"
                  href={`/student-hub/essentials/${item.slug}`}
                >
                  <StudyEssentialCover
                    className="aspect-[4/3] w-full"
                    coverEmoji={item.coverEmoji}
                    emojiClassName="text-6xl transition duration-500 group-hover:scale-110 motion-reduce:transform-none"
                    imageUrl={item.imageUrl}
                    slug={item.slug}
                    title={item.title}
                  />
                  <span className="flex flex-1 flex-col p-4">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">
                        {item.format === "DIGITAL" ? "Digital" : "Physical"}
                      </span>
                      {item.source === "PARTNER" ? (
                        <span className="rounded-full bg-kondo-lime/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-kondo-forest dark:bg-lime-400/15 dark:text-lime-200">
                          Partner
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2.5 line-clamp-2 font-black leading-snug group-hover:text-kondo-green">
                      {item.title}
                    </span>
                    <span className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {item.shortDescription}
                    </span>
                    <span className="mt-4 flex items-center justify-between gap-2 pt-1">
                      {price ? (
                        <span className="text-sm font-black tabular-nums">
                          {price}
                        </span>
                      ) : (
                        <span className="truncate text-xs font-bold text-muted-foreground">
                          {item.providerName}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-black text-kondo-green">
                        {item.source === "PARTNER" ? (
                          <>
                            View <ArrowUpRight className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          "Details"
                        )}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Package aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-black">Nothing in this filter yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            The catalogue is curated, so it stays small on purpose. Try another
            filter — new essentials are added as students ask for them.
          </p>
        </div>
      )}
    </div>
  );
}
