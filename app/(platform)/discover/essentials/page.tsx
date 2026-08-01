import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { DiscoverCard } from "@/components/features/discover/DiscoverCard";
import { getKondoEssentials } from "@/lib/kondo-essentials";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Kondo Essentials" };
export const dynamic = "force-dynamic";

export default async function EssentialsPage() {
  const user = await requireUser();
  const sections = await getKondoEssentials({
    viewerId: user.id,
    cityId: user.cityId,
    universityId: user.universityId,
    studentJourney: user.studentJourney,
  });
  await captureServerProductEvent({
    distinctId: user.id,
    event: PRODUCT_EVENTS.ESSENTIALS_OPENED,
    properties: {
      journey: user.studentJourney ?? "unknown",
      section_count: sections.length,
    },
  });
  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link className="text-sm font-black text-kondo-green" href="/discover">
        ← Discover
      </Link>
      <div className="mt-6 rounded-4xl bg-kondo-mint/70 p-7 dark:bg-emerald-400/10 sm:p-10">
        <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          <Sparkles className="h-4 w-4" /> Personalized, not copied
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">
          Kondo Essentials
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
          Useful products, services, homes and selected peer listings for your
          current journey. Every card comes from its authoritative Kondo module.
        </p>
      </div>
      {sections.length ? (
        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.key}>
              <h2 className="text-2xl font-black">{section.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {section.description}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {section.items.map((item) => (
                  <DiscoverCard item={item} key={`${item.type}:${item.id}`} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-4xl border border-dashed border-border p-12 text-center">
          <h2 className="text-xl font-black">
            Essentials are being built from real content
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            There are no matching published resources yet. Kondo does not invent
            products, providers, availability or prices to fill this space.
          </p>
        </div>
      )}
    </div>
  );
}
