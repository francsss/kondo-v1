"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type FilterOption = { id: string; name: string };

export function ScholarshipFilters({
  options,
  values,
  saved,
}: {
  options: {
    countries: FilterOption[];
    universities: FilterOption[];
    levels: FilterOption[];
    fields: FilterOption[];
    funding: FilterOption[];
    statuses: FilterOption[];
  };
  values: {
    q: string;
    country?: string;
    university?: string;
    level?: string;
    field?: string;
    funding?: string;
    status?: string;
  };
  saved: boolean;
}) {
  const [filters, setFilters] = useState({
    country: values.country ?? "",
    university: values.university ?? "",
    level: values.level ?? "",
    field: values.field ?? "",
    funding: values.funding ?? "",
    status: values.status ?? "",
  });

  const fields = [
    ["country", "Destination", options.countries],
    ["university", "University", options.universities],
    ["level", "Study level", options.levels],
    ["field", "Field", options.fields],
    ["funding", "Funding", options.funding],
    ["status", "Status", options.statuses],
  ] as const;

  return (
    <Card className="mt-6 overflow-visible">
      <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex h-14 items-center gap-3 rounded-2xl border border-border px-4 md:col-span-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            aria-label="Search scholarships"
            className="w-full bg-transparent text-sm outline-none"
            defaultValue={values.q}
            name="q"
            placeholder="Scholarship, provider, city or field"
          />
        </label>
        {fields.map(([name, label, fieldOptions]) => (
          <div key={name}>
            <input name={name} type="hidden" value={filters[name]} />
            <SearchableSelect
              clearLabel={`All ${label.toLowerCase()}`}
              label={label}
              onSelect={(value) =>
                setFilters((current) => ({ ...current, [name]: value }))
              }
              options={fieldOptions}
              placeholder={`All ${label.toLowerCase()}`}
              searchPlaceholder={`Search ${label.toLowerCase()}`}
              selected={filters[name]}
            />
          </div>
        ))}
        {saved ? <input name="saved" type="hidden" value="1" /> : null}
        <button className="h-11 self-end rounded-full bg-kondo-ink px-6 text-sm font-black text-white transition hover:-translate-y-0.5 dark:bg-emerald-400 dark:text-kondo-ink">
          Apply filters
        </button>
        <Link
          className="grid h-11 self-end place-items-center rounded-full border border-border text-sm font-black transition hover:border-kondo-green"
          href={
            saved
              ? "/student-hub/scholarships"
              : "/student-hub/scholarships?saved=1"
          }
        >
          {saved ? "All opportunities" : "Saved opportunities"}
        </Link>
      </form>
    </Card>
  );
}
