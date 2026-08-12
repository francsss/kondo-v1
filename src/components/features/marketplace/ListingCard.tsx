"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import {
  ProductCard,
  type ProductCardBadge,
} from "@/components/features/commerce/ProductCard";
import { MediaImage } from "@/components/ui/MediaImage";
import { formatPrice } from "@/lib/presentation";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

/**
 * A Marketplace listing on the shared commerce card.
 *
 * What a student buying second-hand needs from the grid: what it looks like,
 * what it is, what it costs, and where it is. Place and seller share one line
 * rather than taking two — every text line the card spends is a line the photo
 * does not get, and the photo is what people actually browse. The saved count
 * left the card entirely; it decided nothing and cost a row.
 */
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: {
    id: string;
    slug: string;
    title: string;
    priceFen: number;
    isNegotiable: boolean;
    category: { name: string; icon: string | null };
    city: { name: string };
    seller: { firstName: string; lastName: string };
    _count: { favorites: number };
    favorites: Array<{ id: string }>;
    images?: Array<{ mediaId: string | null; altText: string | null }>;
  };
  /** The first row is above the fold; let those images load eagerly. */
  priority?: boolean;
}) {
  const [favorite, setFavorite] = useState(listing.favorites.length > 0);
  const [pending, setPending] = useState(false);
  const cover = listing.images?.[0];

  async function toggleFavorite() {
    // Optimistic: the heart fills on tap and rolls back only if the write
    // fails. A save that waits on a round trip feels broken on mobile data.
    const next = !favorite;
    setFavorite(next);
    setPending(true);
    const response = await fetch(`/api/marketplace/${listing.id}/favorites`, {
      method: next ? "POST" : "DELETE",
      credentials: "include",
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) {
      setFavorite(!next);
      return;
    }
    if (next) {
      captureProductEvent(PRODUCT_EVENTS.MARKETPLACE_LISTING_SAVED, {
        category: listing.category.name,
        city: listing.city.name,
      });
    }
  }

  const badges: ProductCardBadge[] = listing.isNegotiable
    ? [{ label: "Negotiable" }]
    : [];

  return (
    <ProductCard
      action={
        <button
          aria-label={favorite ? "Remove from saved" : "Save this item"}
          aria-pressed={favorite}
          className="grid h-9 w-9 place-items-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-rose-500 active:scale-90 disabled:opacity-60 motion-reduce:transition-none motion-reduce:active:scale-100"
          disabled={pending}
          onClick={toggleFavorite}
          type="button"
        >
          <Heart
            aria-hidden="true"
            className={favorite ? "h-4 w-4 text-rose-500" : "h-4 w-4"}
            fill={favorite ? "currentColor" : "none"}
          />
        </button>
      }
      badges={badges}
      href={`/marketplace/${listing.slug}`}
      media={{
        ratio: "square",
        node: cover?.mediaId ? (
          <MediaImage
            alt={cover.altText ?? listing.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            height={480}
            mediaId={cover.mediaId}
            priority={priority}
            // Two columns on a phone means each image is about half the
            // viewport. Asking for a 960px file to paint 180px was most of
            // the weight of this page.
            sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            width={640}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-full w-full place-items-center bg-gradient-to-br from-kondo-mint to-emerald-50 text-4xl dark:from-emerald-400/10 dark:to-transparent"
          >
            {listing.category.icon ?? "📦"}
          </span>
        ),
      }}
      price={formatPrice(listing.priceFen)}
      secondary={`${listing.city.name} · ${listing.seller.firstName} ${listing.seller.lastName[0]}.`}
      title={listing.title}
    />
  );
}
