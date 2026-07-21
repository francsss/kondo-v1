"use client";

import Link from "next/link";
import { Heart, MapPin } from "lucide-react";
import { useState } from "react";
import { formatPrice } from "@/lib/presentation";
import { cn } from "@/lib/utils";
import { MediaImage } from "@/components/ui/MediaImage";

const categoryStyles: Record<string, string> = {
  Housing:
    "from-teal-100 via-emerald-50 to-lime-100 dark:from-teal-900/40 dark:to-lime-900/20",
  Furniture:
    "from-amber-100 via-orange-50 to-yellow-100 dark:from-amber-900/40 dark:to-yellow-900/20",
  Bicycle:
    "from-sky-100 via-cyan-50 to-teal-100 dark:from-sky-900/40 dark:to-teal-900/20",
  Laptop:
    "from-violet-100 via-indigo-50 to-blue-100 dark:from-violet-900/40 dark:to-blue-900/20",
  Phone:
    "from-rose-100 via-pink-50 to-orange-100 dark:from-rose-900/40 dark:to-orange-900/20",
  Books:
    "from-lime-100 via-green-50 to-emerald-100 dark:from-lime-900/40 dark:to-emerald-900/20",
};

export function ListingCard({
  listing,
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
}) {
  const [favorite, setFavorite] = useState(listing.favorites.length > 0);
  const [favoriteCount, setFavoriteCount] = useState(listing._count.favorites);

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    setFavoriteCount((value) => value + (next ? 1 : -1));
    const response = await fetch(`/api/marketplace/${listing.id}/favorites`, {
      method: next ? "POST" : "DELETE",
      credentials: "include",
    }).catch(() => null);
    if (!response?.ok) {
      setFavorite(!next);
      setFavoriteCount((value) => value + (next ? -1 : 1));
    }
  }

  return (
    <article className="group overflow-hidden rounded-3xl border border-border bg-card text-card-foreground transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div
        className={cn(
          "relative grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br",
          categoryStyles[listing.category.name] ??
            "from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700",
        )}
      >
        {listing.images?.[0]?.mediaId ? (
          <MediaImage
            alt={listing.images[0].altText ?? listing.title}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
            height={720}
            mediaId={listing.images[0].mediaId}
            sizes="(min-width: 1280px) 24vw, (min-width: 768px) 32vw, 48vw"
            width={960}
          />
        ) : (
          <span
            aria-hidden="true"
            className="text-7xl transition duration-500 group-hover:scale-110 group-hover:-rotate-3"
          >
            {listing.category.icon ?? "📦"}
          </span>
        )}
        <button
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorite}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-muted-foreground shadow-sm backdrop-blur transition hover:scale-105 hover:text-rose-500 dark:bg-slate-950/70 dark:text-muted-foreground"
          onClick={toggleFavorite}
          type="button"
        >
          <Heart
            className="h-4 w-4"
            fill={favorite ? "currentColor" : "none"}
          />
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              className="font-bold text-kondo-ink hover:underline dark:text-white"
              href={`/marketplace/${listing.slug}`}
            >
              <h2 className="truncate">{listing.title}</h2>
            </Link>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin aria-hidden="true" className="h-3 w-3" />{" "}
              {listing.city.name}
            </p>
          </div>
          <p className="whitespace-nowrap font-black tracking-tight text-kondo-forest dark:text-emerald-300">
            {formatPrice(listing.priceFen)}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-muted-foreground dark:border-white/10">
          <span>
            {listing.seller.firstName} {listing.seller.lastName[0]}.
          </span>
          <span>
            {listing.isNegotiable ? "Negotiable" : `${favoriteCount} saved`}
          </span>
        </div>
      </div>
    </article>
  );
}
