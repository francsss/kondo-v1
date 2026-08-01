import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Sparkles } from "lucide-react";
import { DiscoverCard } from "@/components/features/discover/DiscoverCard";
import { getDynamicCityHub } from "@/lib/dynamic-city-hub";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return { title: `City Hub · ${(await params).slug}` };
}

export default async function DynamicCityHubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const hub = await getDynamicCityHub((await params).slug, {
    viewerId: user.id,
    cityId: user.cityId,
    universityId: user.universityId,
    studentJourney: user.studentJourney,
  });
  if (!hub) notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <section className="relative overflow-hidden rounded-4xl bg-kondo-forest p-7 text-white shadow-lift sm:p-10 lg:p-14">
        <div
          aria-hidden
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[48px] border-white/5"
        />
        <div className="relative">
          <Link className="text-sm font-black text-kondo-lime" href="/discover">
            ← Discover
          </Link>
          <p className="mt-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-kondo-lime">
            <MapPin className="h-4 w-4" /> Dynamic City Hub
          </p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.055em] sm:text-6xl">
            {hub.city.name}
            {hub.city.nativeName ? (
              <span className="ml-3 text-white/50">{hub.city.nativeName}</span>
            ) : null}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/70">
            {hub.editorial?.summary ??
              `Real student resources currently connected to ${hub.city.name}.`}
          </p>
          <p className="mt-5 max-w-2xl text-xs leading-5 text-white/50">
            All listings below remain owned by their source module. Exact
            private housing locations are never exposed here.
          </p>
        </div>
      </section>
      {hub.groups.length ? (
        <div className="mt-10 space-y-12">
          {hub.groups.map((group) => (
            <section key={group.key}>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{group.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <Link
                  className="shrink-0 text-sm font-black text-kondo-green"
                  href={`/discover?type=${group.key}&cityId=${hub.city.id}`}
                >
                  View all →
                </Link>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {group.items.map((item) => (
                  <DiscoverCard item={item} key={`${item.type}:${item.id}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-4xl border border-dashed border-border p-12 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-kondo-green" />
          <h2 className="mt-3 text-xl font-black">
            No public city content yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            This city exists because students selected it, but no authoritative
            public resources are available yet. Kondo does not create fake pilot
            content.
          </p>
        </div>
      )}
    </div>
  );
}
