import Link from "next/link";
import { ImageOff } from "lucide-react";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatPrice } from "@/lib/presentation";
import { cn } from "@/lib/utils";

/**
 * What the conversation is about, in one row.
 *
 * A marketplace thread is unreadable without it: "is it still available?"
 * means nothing when the seller has fourteen listings. It stays a single
 * compact row so the thread header does not eat the messages on a phone —
 * thumbnail, title, price, and the state of the listing if it has changed.
 */
export function ListingContextStrip({
  className,
  compact = false,
  listing,
  seller,
}: {
  className?: string;
  compact?: boolean;
  listing: {
    slug: string;
    title: string;
    priceFen: number;
    isNegotiable: boolean;
    status: string;
    soldAt: Date | null;
    archivedAt: Date | null;
    city: { name: string };
    images: Array<{ mediaId: string | null; altText: string | null }>;
  };
  seller?: { firstName: string; lastName: string } | null;
}) {
  const cover = listing.images[0];
  const state = listing.soldAt
    ? "Sold"
    : listing.archivedAt
      ? "Archived"
      : listing.status === "RESERVED"
        ? "Reserved"
        : null;

  return (
    <Link
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card p-2 text-card-foreground transition hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:border-emerald-400/25",
        className,
      )}
      href={`/marketplace/${listing.slug}`}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center overflow-hidden rounded-xl bg-muted",
          compact ? "h-11 w-11" : "h-14 w-14",
        )}
      >
        {cover?.mediaId ? (
          <MediaImage
            alt={cover.altText ?? listing.title}
            className="h-full w-full object-cover"
            height={112}
            mediaId={cover.mediaId}
            sizes="56px"
            width={112}
          />
        ) : (
          <ImageOff
            aria-hidden="true"
            className="h-4 w-4 text-muted-foreground"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-black text-kondo-ink dark:text-white">
            {listing.title}
          </span>
          {state ? (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-muted-foreground">
              {state}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-black text-kondo-green">
            {formatPrice(listing.priceFen)}
          </span>
          {listing.isNegotiable ? <span>· Negotiable</span> : null}
          <span className="truncate">· {listing.city.name}</span>
        </span>
        {seller && !compact ? (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            Sold by {seller.firstName} {seller.lastName}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
