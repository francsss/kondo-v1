import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import type { getCityHousingProjection } from "@/lib/housing-projections";

type CityHousingItem = Awaited<
  ReturnType<typeof getCityHousingProjection>
>[number];

export function CityHousingRail({
  cityName,
  listings,
}: {
  cityName: string;
  listings: CityHousingItem[];
}) {
  if (!listings.length) return null;
  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Live Housing
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
            Homes in {cityName}
          </h2>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-sm font-black text-kondo-green hover:underline"
          href="/housing/search"
        >
          View Housing <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="no-scrollbar mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
        {listings.map((listing) => {
          const cover = listing.media[0];
          return (
            <Link
              className="w-[270px] shrink-0 snap-start overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md sm:w-[320px]"
              href={`/housing/listings/${listing.slug}`}
              key={listing.id}
            >
              <div className="aspect-[16/10] bg-muted">
                {cover ? (
                  <MediaImage
                    alt={cover.altText}
                    className="h-full w-full object-cover"
                    height={400}
                    mediaId={cover.mediaId}
                    sizes="320px"
                    width={640}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <House className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <p className="line-clamp-2 font-black">{listing.title}</p>
                <p className="mt-2 truncate text-xs text-muted-foreground">
                  {listing.publicLocationLabel}
                </p>
                <p className="mt-3 text-sm font-black text-kondo-green">
                  {listing.currency}{" "}
                  {Math.round(listing.monthlyRentMinor / 100)}
                  /month
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
