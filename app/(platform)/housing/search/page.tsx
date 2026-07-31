import type { Metadata } from "next";
import Link from "next/link";
import { HousingListingCard } from "@/components/features/housing/HousingListingCard";
import {
  HOUSING_ANALYTICS_EVENTS,
  HousingAnalytics,
} from "@/components/features/housing/HousingAnalytics";
import { HousingNav } from "@/components/features/housing/HousingNav";
import { HousingSearchForm } from "@/components/features/housing/HousingSearchForm";
import { Card } from "@/components/ui/Card";
import { housingSearchSchema } from "@/features/housing/schemas";
import { searchHousing } from "@/lib/housing-search";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Search Housing" };

export default async function HousingSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const parsed = housingSearchSchema.safeParse({
    q: params.q,
    cityId: params.cityId,
    universityId: params.universityId,
    organizationId: params.organizationId,
    types: params.types ? [params.types] : [],
    minimumRentMinor: params.minRent
      ? Math.round(Number(params.minRent) * 100)
      : undefined,
    maximumRentMinor: params.maxRent
      ? Math.round(Number(params.maxRent) * 100)
      : undefined,
    bedrooms: params.bedrooms,
    availableFrom: params.availableFrom,
    minimumStayMonths: params.minimumStayMonths,
    furnished: params.furnished === "true" ? true : undefined,
    amenities: params.amenities ? [params.amenities] : [],
    publisher: params.publisher ?? "ALL",
    petPolicy: params.petPolicy,
    smokingPolicy: params.smokingPolicy,
    sort: params.sort,
    cursor: params.cursor,
    limit: 24,
  });
  const query = parsed.success
    ? parsed.data
    : housingSearchSchema.parse({
        types: [],
        amenities: [],
        publisher: "ALL",
        sort: "RELEVANCE",
        limit: 24,
      });
  const [cities, universities, results] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    searchHousing(query),
  ]);
  const nextHref = results.nextCursor
    ? (() => {
        const next = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value && key !== "cursor") next.set(key, value);
        }
        next.set("cursor", results.nextCursor);
        return `/housing/search?${next.toString()}`;
      })()
    : null;
  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingAnalytics
        event={HOUSING_ANALYTICS_EVENTS.HOUSING_SEARCH_STARTED}
        properties={{
          filtered: Boolean(
            params.q || params.cityId || params.types || params.maxRent,
          ),
          result_count: results.total,
        }}
      />
      <HousingNav active="/housing/search" />
      <div className="mb-6 mt-7">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Search Housing
        </p>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Find your next home
        </h1>
        <p className="mt-2 text-muted-foreground">
          {results.total} {results.total === 1 ? "place" : "places"} available
        </p>
      </div>
      <HousingSearchForm
        cities={cities}
        defaults={params}
        universities={universities}
      />
      {results.items.length ? (
        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {results.items.map((listing) => (
            <HousingListingCard key={listing.id} listing={listing} />
          ))}
          {nextHref ? (
            <div className="sm:col-span-2 xl:col-span-3">
              <Link
                className="mx-auto flex h-11 w-fit items-center justify-center rounded-full border border-border bg-card px-6 text-sm font-black transition hover:border-primary hover:bg-secondary"
                href={nextHref}
              >
                Next results
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <Card className="mt-7 py-14 text-center">
          <h2 className="font-display text-xl font-black">
            No exact match yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Try a nearby city, a broader home type or a higher budget. You can
            also publish a Housing request so members can help.
          </p>
        </Card>
      )}
    </main>
  );
}
