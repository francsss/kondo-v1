"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";

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
      <label>
        <span className="sr-only">Filter by city</span>
        <select
          className="h-12 w-full rounded-2xl border-0 bg-muted/50 px-4 text-sm font-bold outline-none ring-kondo-green focus:ring-2"
          onChange={(event) => setCity(event.target.value)}
          value={searchParams.get("cityId") ?? ""}
        >
          <option value="">All active cities</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>
      </label>
      {supportsUniversity ? (
        <label>
          <span className="sr-only">Filter by university</span>
          <select
            className="h-12 w-full rounded-2xl border-0 bg-muted/50 px-4 text-sm font-bold outline-none ring-kondo-green focus:ring-2"
            onChange={(event) => setUniversity(event.target.value)}
            value={searchParams.get("universityId") ?? ""}
          >
            <option value="">All universities</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
