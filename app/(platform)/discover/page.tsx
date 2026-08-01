import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, Compass, Sparkles } from "lucide-react";
import { DiscoverCard } from "@/components/features/discover/DiscoverCard";
import { DiscoverControls } from "@/components/features/discover/DiscoverControls";
import {
  HorizontalTabs,
  TabPanelTransition,
} from "@/components/ui/HorizontalTabs";
import { DISCOVER_PROVIDERS } from "@/features/discover/registry";
import {
  DISCOVER_RESOURCE_TYPES,
  type DiscoverResourceType,
} from "@/features/discover/types";
import { discoverResources } from "@/lib/discover";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Discover" };
export const dynamic = "force-dynamic";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const type = DISCOVER_RESOURCE_TYPES.includes(
    params.type as DiscoverResourceType,
  )
    ? (params.type as DiscoverResourceType)
    : undefined;
  const [groups, cities, universities] = await Promise.all([
    discoverResources({
      context: {
        viewerId: user.id,
        cityId: user.cityId,
        universityId: user.universityId,
        studentJourney: user.studentJourney,
      },
      type,
      filters: {
        query: params.q,
        cityId: params.cityId,
        universityId: params.universityId,
      },
    }),
    prisma.city.findMany({
      where: { isActive: true, users: { some: { status: "ACTIVE" } } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.university.findMany({
      where: {
        isActive: true,
        ...(params.cityId ? { cityId: params.cityId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    captureServerProductEvent({
      distinctId: user.id,
      event: PRODUCT_EVENTS.DISCOVER_OPENED,
      properties: {
        resource_type: type ?? "all",
        has_query: Boolean(params.q),
        city_filtered: Boolean(params.cityId),
      },
    }),
  ]);
  const tabs = [
    { key: "all", label: "For you", href: "/discover" },
    ...DISCOVER_PROVIDERS.map((provider) => ({
      key: provider.key,
      label: provider.label,
      href: `/discover?type=${provider.key}`,
    })),
  ];
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === (type ?? "all")),
  );
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <section className="overflow-hidden rounded-4xl bg-gradient-to-br from-kondo-navy via-kondo-forest to-[#237d61] p-6 text-white shadow-lift sm:p-9">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-kondo-lime">
              <Compass className="h-4 w-4" /> One place to discover Kondo
            </p>
            <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] sm:text-6xl">
              Find what moves your journey forward.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
              Real public resources from their source modules—with clear
              context, safe visibility and no copied records.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
              href="/discover/saved"
            >
              <Bookmark className="h-4 w-4" /> Saved
            </Link>
            <Link
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-kondo-forest transition hover:bg-kondo-lime"
              href="/discover/essentials"
            >
              <Sparkles className="h-4 w-4" /> Kondo Essentials
            </Link>
          </div>
        </div>
      </section>
      <DiscoverControls
        cities={cities}
        resourceType={type}
        universities={universities}
      />
      <div className="mt-5 border-b border-border pb-2">
        <HorizontalTabs
          activeKey={type ?? "all"}
          ariaLabel="Discover categories"
          tabs={tabs}
        />
      </div>
      <TabPanelTransition className="mt-8" index={activeIndex}>
        {groups.length ? (
          <div className="space-y-10">
            {groups.map((group) => (
              <section key={group.key}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">
                      {group.label}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  {!type ? (
                    <Link
                      className="shrink-0 text-sm font-black text-kondo-green"
                      href={`/discover?type=${group.key}`}
                    >
                      View all →
                    </Link>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map((item) => (
                    <DiscoverCard item={item} key={`${item.type}:${item.id}`} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-4xl border border-dashed border-border p-12 text-center">
            <h2 className="text-xl font-black">No public results</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Try another search or city. Discover never fills an empty result
              with fake content.
            </p>
          </div>
        )}
      </TabPanelTransition>
    </div>
  );
}
