import Link from "next/link";
import { BadgeCheck, Building2, MapPin } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";

export type HousingListingCardItem = {
  id: string;
  slug: string;
  title: string;
  typeLabel: string;
  shortDescription: string;
  price: { monthlyRentMinor: number; currency: string };
  location: {
    label: string;
    city: { name: string };
  };
  media: Array<{ mediaId: string; altText: string; isCover: boolean }>;
  publisher: {
    name: string;
    verified: boolean;
    type: "PERSONAL" | "ORGANIZATION";
  };
  availability: { availableFrom: string | null };
};

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export function HousingListingCard({
  listing,
}: {
  listing: HousingListingCardItem;
}) {
  const cover = listing.media.find((item) => item.isCover) ?? listing.media[0];
  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-lg">
      <Link
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/housing/listings/${listing.slug}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {cover ? (
            <MediaImage
              alt={cover.altText}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              height={600}
              mediaId={cover.mediaId}
              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
              width={800}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Building2 aria-hidden className="h-9 w-9" />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-black shadow-sm backdrop-blur">
            {listing.typeLabel}
          </span>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="line-clamp-2 font-display text-lg font-black leading-tight">
              {listing.title}
            </h2>
            <p className="shrink-0 text-right text-sm font-black text-kondo-green">
              {money(listing.price.monthlyRentMinor, listing.price.currency)}
              <span className="block text-[10px] font-bold text-muted-foreground">
                / month
              </span>
            </p>
          </div>
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {listing.shortDescription}
          </p>
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <MapPin aria-hidden className="h-3.5 w-3.5" />
            <span className="truncate">
              {listing.location.label}, {listing.location.city.name}
            </span>
          </div>
          <div className="flex items-center gap-2 border-t border-border/70 pt-3 text-xs font-bold">
            <span className="truncate">{listing.publisher.name}</span>
            {listing.publisher.verified ? (
              <BadgeCheck
                aria-label="Verified publisher"
                className="h-4 w-4 shrink-0 text-kondo-green"
              />
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}
