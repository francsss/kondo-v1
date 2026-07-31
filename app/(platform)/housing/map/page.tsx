import type { Metadata } from "next";
import Link from "next/link";
import { HousingNav } from "@/components/features/housing/HousingNav";
import {
  HOUSING_ANALYTICS_EVENTS,
  HousingAnalytics,
} from "@/components/features/housing/HousingAnalytics";
import { HousingMap } from "@/components/features/housing/HousingMap";
import { listHousingMapPoints } from "@/lib/housing-search";

export const metadata: Metadata = { title: "Housing Map" };

export default async function HousingMapPage() {
  const points = await listHousingMapPoints({ limit: 80 });
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingAnalytics
        event={HOUSING_ANALYTICS_EVENTS.HOUSING_MAP_OPENED}
        properties={{ marker_count: points.length }}
      />
      <HousingNav active="/housing/map" />
      <div className="mb-6 mt-7">
        <h1 className="font-display text-3xl font-black sm:text-4xl">
          Explore by area
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Markers use privacy-safe approximate coordinates. Exact private
          addresses are never included in this view.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <HousingMap points={points} />
        <div className="space-y-3">
          {points.slice(0, 12).map((point) => (
            <Link
              className="block rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/20 hover:shadow-md"
              href={point.href}
              key={point.id}
            >
              <p className="font-bold">{point.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {point.locationLabel} · {point.cityName}
              </p>
              <p className="mt-2 text-sm font-black text-kondo-green">
                {point.price.currency}{" "}
                {Math.round(point.price.amountMinor / 100)}
                /month
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
