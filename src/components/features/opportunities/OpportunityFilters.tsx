"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

type Option = { id: string; name: string };

export function OpportunityFilters({
  countries,
  cities,
  universities,
}: {
  countries: Option[];
  cities: Option[];
  universities: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [expanded, setExpanded] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("cursor");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query !== (searchParams.get("q") ?? "")) setParam("q", query);
    }, 250);
    return () => window.clearTimeout(timeout);
    // setParam is intentionally derived from the current URL on each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, searchParams]);

  const hasFilters = [...searchParams.keys()].some(
    (key) => key !== "category" && key !== "q",
  );

  return (
    <div className="mt-5">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search opportunities</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search scholarships, internships, jobs…"
            className="w-full rounded-2xl border border-black/10 bg-white py-3 pl-11 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-kondo-green dark:border-white/10 dark:bg-white/5"
          />
        </label>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-black/10 px-4 text-sm font-bold dark:border-white/10"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">Filters</span>
        </button>
      </div>

      {expanded ? (
        <div className="mt-3 grid gap-3 rounded-3xl border border-black/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-2 lg:grid-cols-4">
          <SelectFilter
            label="Country"
            param="countryId"
            options={countries}
            searchParams={searchParams}
            onChange={setParam}
          />
          <SelectFilter
            label="City"
            param="cityId"
            options={cities}
            searchParams={searchParams}
            onChange={setParam}
          />
          <SelectFilter
            label="University"
            param="universityId"
            options={universities}
            searchParams={searchParams}
            onChange={setParam}
          />
          <SimpleSelect
            label="Work mode"
            param="workMode"
            searchParams={searchParams}
            onChange={setParam}
            options={[
              ["ON_SITE", "On site"],
              ["REMOTE", "Remote"],
              ["HYBRID", "Hybrid"],
              ["CAMPUS", "On campus"],
            ]}
          />
          <SimpleSelect
            label="Degree level"
            param="degreeLevel"
            searchParams={searchParams}
            onChange={setParam}
            options={[
              ["BACHELORS", "Bachelor"],
              ["MASTERS", "Master"],
              ["DOCTORATE", "PhD"],
              ["LANGUAGE", "Language program"],
            ]}
          />
          <SimpleSelect
            label="Funding"
            param="funding"
            searchParams={searchParams}
            onChange={setParam}
            options={[
              ["FULLY_FUNDED", "Fully funded"],
              ["PARTIALLY_FUNDED", "Partially funded"],
              ["TUITION_ONLY", "Tuition only"],
              ["STIPEND_ONLY", "Stipend only"],
            ]}
          />
          <SimpleSelect
            label="Application"
            param="applicationMethod"
            searchParams={searchParams}
            onChange={setParam}
            options={[
              ["KONDO_APPLICATION", "Apply in Kondo"],
              ["EXTERNAL_URL", "External website"],
              ["EMAIL", "Email"],
            ]}
          />
          <SimpleSelect
            label="Deadline"
            param="deadlineDays"
            searchParams={searchParams}
            onChange={setParam}
            options={[
              ["7", "Within 7 days"],
              ["30", "Within 30 days"],
              ["90", "Within 90 days"],
            ]}
          />
          <div className="flex flex-wrap items-end gap-3 pb-1 text-sm">
            <CheckFilter
              label="Paid only"
              param="paid"
              searchParams={searchParams}
              onChange={setParam}
            />
            <CheckFilter
              label="Verified"
              param="verified"
              searchParams={searchParams}
              onChange={setParam}
            />
            <CheckFilter
              label="Partner"
              param="partner"
              searchParams={searchParams}
              onChange={setParam}
            />
          </div>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                const category = searchParams.get("category");
                if (category) params.set("category", category);
                if (query) params.set("q", query);
                router.replace(`${pathname}?${params.toString()}`, {
                  scroll: false,
                });
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-rose-600 sm:col-span-2 lg:col-span-4"
            >
              <X className="h-4 w-4" /> Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SelectFilter({
  label,
  param,
  options,
  searchParams,
  onChange,
}: {
  label: string;
  param: string;
  options: Option[];
  searchParams: URLSearchParams;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label className="text-xs font-bold text-muted-foreground">
      {label}
      <select
        value={searchParams.get(param) ?? ""}
        onChange={(event) => onChange(param, event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3 py-2.5 text-sm font-medium text-foreground dark:border-white/10"
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SimpleSelect({
  label,
  param,
  options,
  searchParams,
  onChange,
}: {
  label: string;
  param: string;
  options: readonly (readonly [string, string])[];
  searchParams: URLSearchParams;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label className="text-xs font-bold text-muted-foreground">
      {label}
      <select
        value={searchParams.get(param) ?? ""}
        onChange={(event) => onChange(param, event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-black/10 bg-background px-3 py-2.5 text-sm font-medium text-foreground dark:border-white/10"
      >
        <option value="">All</option>
        {options.map(([key, optionLabel]) => (
          <option key={key} value={key}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckFilter({
  label,
  param,
  searchParams,
  onChange,
}: {
  label: string;
  param: string;
  searchParams: URLSearchParams;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      <input
        type="checkbox"
        checked={searchParams.get(param) === "true"}
        onChange={(event) =>
          onChange(param, event.target.checked ? "true" : "")
        }
        className="accent-kondo-green"
      />
      {label}
    </label>
  );
}
