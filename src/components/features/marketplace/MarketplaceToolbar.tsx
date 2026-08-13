"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownUp, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cn } from "@/lib/utils";

/**
 * Everything that used to sit between the member and the products.
 *
 * Before: a navy card holding six full-height form controls, then ten 96px
 * category tiles in a two-column grid. On a phone that was most of a screen
 * and a half of chrome before the first item. The controls have not gone
 * away — search, city, price range and sort are the same query parameters the
 * page already reads — they are just folded into a rail and a sheet, so the
 * grid starts near the top of the page.
 *
 * Filtering stays server-side. Every control writes to the URL and lets the
 * existing server component re-query; nothing here holds a second copy of the
 * listings.
 */

export type MarketplaceQuery = {
  q?: string;
  category?: string;
  city?: string;
  min?: string;
  max?: string;
  sort?: string;
};

export type MarketplaceCategoryOption = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  count: number;
};

const SORT_OPTIONS = [
  { value: "latest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
] as const;

function buildHref(query: MarketplaceQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const search = params.toString();
  return search ? `/marketplace?${search}` : "/marketplace";
}

export function MarketplaceToolbar({
  categories,
  cities,
  query,
  resultCount,
}: {
  categories: MarketplaceCategoryOption[];
  cities: Array<{ id: string; slug: string; name: string }>;
  query: MarketplaceQuery;
  resultCount: number;
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [draft, setDraft] = useState<MarketplaceQuery>(query);

  const activeCity = cities.find((city) => city.slug === query.city);
  const activeCategory = categories.find(
    (category) => category.slug === query.category,
  );
  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === (query.sort ?? "latest"))
      ?.label ?? "Newest";

  // Only the filters a member can see and remove count towards the badge.
  const appliedCount = useMemo(
    () =>
      [query.city, query.min, query.max, query.q].filter(Boolean).length +
      (query.category ? 1 : 0),
    [query],
  );

  function apply(next: MarketplaceQuery) {
    setFiltersOpen(false);
    setSortOpen(false);
    router.push(buildHref(next), { scroll: false });
  }

  const chips: Array<{ label: string; next: MarketplaceQuery }> = [];
  if (query.q)
    chips.push({ label: `“${query.q}”`, next: { ...query, q: undefined } });
  if (activeCategory)
    chips.push({
      label: activeCategory.name,
      next: { ...query, category: undefined },
    });
  if (activeCity)
    chips.push({ label: activeCity.name, next: { ...query, city: undefined } });
  if (query.min || query.max) {
    chips.push({
      label:
        query.min && query.max
          ? `¥${query.min}–¥${query.max}`
          : query.min
            ? `Over ¥${query.min}`
            : `Under ¥${query.max}`,
      next: { ...query, min: undefined, max: undefined },
    });
  }

  return (
    <div className="mt-4">
      <form
        action="/marketplace"
        className="kondo-field flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4"
        role="search"
      >
        <Search
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-kondo-green"
        />
        <input
          aria-label="Search the Marketplace"
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          defaultValue={query.q ?? ""}
          enterKeyHint="search"
          name="q"
          placeholder="Search items"
          type="text"
        />
        {/* Keep the rest of the query alive when search is submitted. */}
        {query.category ? (
          <input name="category" type="hidden" value={query.category} />
        ) : null}
        {query.city ? (
          <input name="city" type="hidden" value={query.city} />
        ) : null}
        {query.sort ? (
          <input name="sort" type="hidden" value={query.sort} />
        ) : null}
      </form>

      {/* Categories: a rail, not a wall. Horizontal scroll keeps ten of them
          to one line of vertical space. */}
      <div className="-mx-4 mt-3 overflow-x-auto overscroll-x-contain scrollbar-none px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <CategoryPill
            active={!query.category}
            href={buildHref({ ...query, category: undefined })}
            label="All"
          />
          {categories.map((category) => (
            <CategoryPill
              active={query.category === category.slug}
              href={buildHref({ ...query, category: category.slug })}
              icon={category.icon}
              key={category.id}
              label={category.name}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition",
            appliedCount
              ? "border-kondo-green/40 bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
              : "border-border bg-card text-foreground hover:border-kondo-green/40",
          )}
          onClick={() => {
            setDraft(query);
            setFiltersOpen(true);
          }}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
          Filters{appliedCount ? ` · ${appliedCount}` : ""}
        </button>
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground transition hover:border-kondo-green/40"
          onClick={() => setSortOpen(true)}
          type="button"
        >
          <ArrowDownUp aria-hidden="true" className="h-3.5 w-3.5" />
          {sortLabel}
        </button>
        {chips.map((chip) => (
          <Link
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-3 text-xs font-bold text-foreground transition hover:border-kondo-green/40"
            href={buildHref(chip.next)}
            key={chip.label}
            scroll={false}
          >
            {chip.label}
            <X aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
          </Link>
        ))}
      </div>

      <BottomSheet
        footer={
          <div className="flex items-center gap-2 pb-1">
            <Link
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border text-sm font-bold text-foreground"
              href="/marketplace"
              onClick={() => setFiltersOpen(false)}
              scroll={false}
            >
              Clear all
            </Link>
            <button
              className="inline-flex h-11 flex-[2] items-center justify-center rounded-full bg-kondo-green text-sm font-black text-white transition active:scale-[0.99] motion-reduce:active:scale-100"
              onClick={() => apply(draft)}
              type="button"
            >
              Show items
            </button>
          </div>
        }
        onClose={() => setFiltersOpen(false)}
        open={filtersOpen}
        title="Filters"
      >
        <FilterSection label="Category">
          <div className="flex flex-wrap gap-2">
            <ChoicePill
              active={!draft.category}
              label="All"
              onClick={() => setDraft({ ...draft, category: undefined })}
            />
            {categories.map((category) => (
              <ChoicePill
                active={draft.category === category.slug}
                key={category.id}
                label={`${category.name} · ${category.count}`}
                onClick={() => setDraft({ ...draft, category: category.slug })}
              />
            ))}
          </div>
        </FilterSection>

        <FilterSection label="Price (¥)">
          <div className="flex items-center gap-2">
            <input
              aria-label="Minimum price"
              className="kondo-field h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                setDraft({ ...draft, min: event.target.value || undefined })
              }
              placeholder="Min"
              type="number"
              value={draft.min ?? ""}
            />
            <span className="text-muted-foreground">–</span>
            <input
              aria-label="Maximum price"
              className="kondo-field h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none"
              inputMode="numeric"
              min={0}
              onChange={(event) =>
                setDraft({ ...draft, max: event.target.value || undefined })
              }
              placeholder="Max"
              type="number"
              value={draft.max ?? ""}
            />
          </div>
        </FilterSection>

        <FilterSection label="City">
          <div className="flex flex-wrap gap-2">
            <ChoicePill
              active={!draft.city}
              label="All cities"
              onClick={() => setDraft({ ...draft, city: undefined })}
            />
            {cities.map((city) => (
              <ChoicePill
                active={draft.city === city.slug}
                key={city.id}
                label={city.name}
                onClick={() => setDraft({ ...draft, city: city.slug })}
              />
            ))}
          </div>
        </FilterSection>
      </BottomSheet>

      <BottomSheet
        onClose={() => setSortOpen(false)}
        open={sortOpen}
        title="Sort"
      >
        <div className="space-y-1">
          {SORT_OPTIONS.map((option) => {
            const active = (query.sort ?? "latest") === option.value;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-bold transition",
                  active
                    ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
                    : "text-foreground hover:bg-muted",
                )}
                key={option.value}
                onClick={() => apply({ ...query, sort: option.value })}
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      <p className="mt-3 text-xs text-muted-foreground">
        {resultCount} {resultCount === 1 ? "item" : "items"}
      </p>
    </div>
  );
}

function CategoryPill({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon?: string | null;
  active: boolean;
}) {
  return (
    <Link
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition",
        active
          ? "border-kondo-green bg-kondo-green text-white"
          : "border-border bg-card text-foreground hover:border-kondo-green/40",
      )}
      href={href}
      scroll={false}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </Link>
  );
}

function ChoicePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-10 items-center rounded-full border px-3 text-xs font-bold transition",
        active
          ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300"
          : "border-border bg-card text-foreground hover:border-kondo-green/40",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  );
}
