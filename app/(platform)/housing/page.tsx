import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HeartHandshake, Home, ShieldCheck } from "lucide-react";
import { HousingListingCard } from "@/components/features/housing/HousingListingCard";
import {
  HOUSING_ANALYTICS_EVENTS,
  HousingAnalytics,
} from "@/components/features/housing/HousingAnalytics";
import { HousingNav } from "@/components/features/housing/HousingNav";
import { HousingSearchForm } from "@/components/features/housing/HousingSearchForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { searchHousing, getHousingRecommendations } from "@/lib/housing-search";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Housing",
  description: "Find trusted student housing and roommates across China.",
};

export default async function HousingPage() {
  const user = await requireUser();
  const [cities, newest, recommendations] = await Promise.all([
    prisma.city.findMany({
      where: {
        isActive: true,
        OR: [
          { users: { some: {} } },
          { housingListings: { some: { status: "PUBLISHED" } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    searchHousing({
      types: [],
      amenities: [],
      publisher: "ALL",
      sort: "NEWEST",
      limit: 8,
    }),
    getHousingRecommendations(user.id, 6),
  ]);
  const featured = recommendations.length
    ? recommendations.map(({ listing }) => listing)
    : newest.items.slice(0, 6);

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <HousingAnalytics event={HOUSING_ANALYTICS_EVENTS.HOUSING_HOME_VIEWED} />
      <HousingNav active="/housing" />
      <section className="relative mt-5 overflow-hidden rounded-[2.25rem] border border-border bg-foreground px-6 py-10 text-background shadow-xl sm:px-10 lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-kondo-green/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-kondo-lime">
            Kondo Housing
          </p>
          <h1 className="font-display text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">
            Find a place that feels right.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-background/70 sm:text-lg">
            Student-focused homes, transparent costs, privacy-safe locations,
            trusted publishers and compatible roommates—all in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              asChild
              className="bg-kondo-lime text-kondo-ink hover:bg-kondo-lime/90"
            >
              <Link href="/housing/search">
                Explore homes <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/housing/create">List a place</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="-mt-1 px-1 pt-6 lg:px-8">
        <HousingSearchForm cities={cities} compact />
      </div>

      <section className="mt-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Curated for you
            </p>
            <h2 className="mt-1 font-display text-2xl font-black sm:text-3xl">
              {recommendations.length
                ? "Matches for your journey"
                : "Newest homes"}
            </h2>
          </div>
          <Link
            className="text-sm font-black text-kondo-green hover:underline"
            href="/housing/search"
          >
            View all
          </Link>
        </div>
        {featured.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((listing) => (
              <HousingListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <Card className="py-12 text-center">
            <Home className="mx-auto h-9 w-9 text-muted-foreground" />
            <h3 className="mt-4 font-display text-xl font-black">
              The first homes are on their way
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              Publish a student room, sublet or organization-managed residence
              to help this community get started.
            </p>
          </Card>
        )}
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: "Privacy by default",
            body: "Exact addresses stay private unless a publisher explicitly chooses otherwise.",
          },
          {
            icon: HeartHandshake,
            title: "Roommate matching",
            body: "Discover people through timing, budget and lifestyle compatibility.",
          },
          {
            icon: Home,
            title: "Student-first listings",
            body: "Compare full monthly costs, availability and essential house details.",
          },
        ].map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <Icon aria-hidden className="h-6 w-6 text-kondo-green" />
            <h3 className="mt-4 font-display text-lg font-black">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {body}
            </p>
          </Card>
        ))}
      </section>
    </main>
  );
}
