"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

export function MarketplaceFilterBar({
  cities,
  values,
}: {
  cities: Array<{ id: string; slug: string; name: string }>;
  values: {
    q?: string;
    city?: string;
    min?: string;
    max?: string;
    sort?: string;
    category?: string;
  };
}) {
  const [city, setCity] = useState(values.city ?? "");
  return (
    <Card className="mt-8 overflow-visible bg-kondo-navy text-white">
      <form className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_190px_130px_130px_160px_auto]">
        <label className="relative">
          <span className="sr-only">Search items</span>
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-14 w-full rounded-2xl bg-white pl-11 pr-4 text-sm text-kondo-ink"
            defaultValue={values.q}
            name="q"
            placeholder="Search items"
          />
        </label>
        <div className="text-kondo-ink [&>span]:sr-only">
          <input name="city" type="hidden" value={city} />
          <SearchableSelect
            clearLabel="All cities"
            label="City"
            onSelect={setCity}
            options={cities.map((item) => ({
              id: item.slug,
              name: item.name,
            }))}
            placeholder="All cities"
            searchPlaceholder="Search cities"
            selected={city}
          />
        </div>
        <input
          className="h-14 rounded-2xl bg-white px-3 text-sm text-kondo-ink"
          defaultValue={values.min}
          min={0}
          name="min"
          placeholder="Min ¥"
          type="number"
        />
        <input
          className="h-14 rounded-2xl bg-white px-3 text-sm text-kondo-ink"
          defaultValue={values.max}
          min={0}
          name="max"
          placeholder="Max ¥"
          type="number"
        />
        <select
          className="h-14 rounded-2xl bg-white px-3 text-sm text-kondo-ink"
          defaultValue={values.sort ?? "latest"}
          name="sort"
        >
          <option value="latest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price-asc">Price low to high</option>
          <option value="price-desc">Price high to low</option>
        </select>
        {values.category ? (
          <input name="category" type="hidden" value={values.category} />
        ) : null}
        <Button
          className="h-14 bg-white text-kondo-forest hover:bg-kondo-lime"
          type="submit"
        >
          Filter
        </Button>
      </form>
    </Card>
  );
}
