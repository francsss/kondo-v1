"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export function DiscoverControls({
  cities,
  universities,
  resourceType,
}: {
  cities: Array<{ id: string; name: string }>;
  universities: Array<{ id: string; name: string }>;
  resourceType?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const current = searchParams.get("q") ?? "";
      if (query.trim() === current) return;
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams]);

  function setCity(cityId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (cityId) next.set("cityId", cityId);
    else next.delete("cityId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setUniversity(universityId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (universityId) next.set("universityId", universityId);
    else next.delete("universityId");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const supportsUniversity =
    !resourceType ||
    [
      "housing",
      "opportunities",
      "communities",
      "universities",
      "events",
    ].includes(resourceType);

  return (
    <div
      className={`mt-6 grid gap-3 rounded-3xl border border-border bg-card p-3 shadow-sm ${
        supportsUniversity
          ? "sm:grid-cols-[minmax(0,1fr)_220px_220px]"
          : "sm:grid-cols-[minmax(0,1fr)_240px]"
      }`}
    >
      <label className="relative">
        <span className="sr-only">Search Discover</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoComplete="off"
          className="h-12 w-full rounded-2xl bg-muted/50 pl-11 pr-11 text-sm outline-none ring-kondo-green transition focus:ring-2"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search everything useful on Kondo…"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-muted"
            onClick={() => setQuery("")}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </label>
      {/* Hundreds of cities and universities: a native select forces the
          student to scroll blindly, so both use the shared searchable
          selector instead. */}
      <SearchableSelect
        clearLabel="All active cities"
        label="Filter by city"
        onSelect={setCity}
        options={cities.map((city) => ({ id: city.id, name: city.name }))}
        placeholder="All active cities"
        searchPlaceholder="Search city"
        selected={searchParams.get("cityId") ?? ""}
      />
      {supportsUniversity ? (
        <SearchableSelect
          clearLabel="All universities"
          label="Filter by university"
          onSelect={setUniversity}
          options={universities.map((university) => ({
            id: university.id,
            name: university.name,
          }))}
          placeholder="All universities"
          searchPlaceholder="Search university"
          selected={searchParams.get("universityId") ?? ""}
        />
      ) : null}
    </div>
  );
}
