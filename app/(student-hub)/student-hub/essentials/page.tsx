import type { Metadata } from "next";
import Link from "next/link";
import { Package, Receipt } from "lucide-react";
import { ProductGrid } from "@/components/features/commerce/ProductCard";
import { StudyEssentialCard } from "@/components/features/student-hub/StudyEssentialCard";
import { HorizontalTabs } from "@/components/ui/HorizontalTabs";
import { requireUser } from "@/lib/server-auth";
import { ownedEssentialIds } from "@/lib/study-workspace";
import {
  countStudyEssentialsByFilter,
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
  const user = await requireUser();
  const requested = (await searchParams).filter;
  const filter: StudyEssentialFilterKey = isStudyEssentialFilter(requested)
    ? requested
    : "all";
  const [items, counts] = await Promise.all([
    listStudyEssentials(filter),
    countStudyEssentialsByFilter(),
  ]);
  // One query for the whole page rather than one per card.
  const owned = await ownedEssentialIds(
    user.id,
    items.map((item) => item.id),
  );

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-24 pt-4 sm:px-6 sm:py-9 lg:px-8">
      {/*
       * A store earns its opening screen with covers, not with a paragraph
       * about what the store is. The editorial line still exists — it just
       * stops being the first screenful on a phone, where it pushed every
       * product below the fold.
       */}
      <header className="max-w-3xl">
        <h1 className="text-balance font-display text-2xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
          Everything you need to study well.
        </h1>
        <p className="mt-2 hidden text-pretty text-sm leading-7 text-muted-foreground sm:block sm:text-base">
          A short, chosen catalogue rather than a marketplace — the guides,
          language material and physical essentials that international students
          in China actually use, plus a few things our partners do better than
          we would.
        </p>
      </header>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-7">
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
        <ProductGrid className="mt-4 sm:mt-6">
          {items.map((item, index) => (
            <StudyEssentialCard
              item={item}
              key={item.id}
              owned={owned.has(item.id)}
              priority={index < 4}
            />
          ))}
        </ProductGrid>
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
