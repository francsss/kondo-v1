import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one card Kondo sells things through.
 *
 * Three surfaces used to draw their own: the Marketplace listing, the Study
 * Essentials shelf and the organization catalogue. They shared a shape —
 * image, title, price — and disagreed on everything else, including how much
 * of the card the image was allowed to have. This holds the shared geometry so
 * they read as one product, while each surface keeps the fields that actually
 * mean something to it.
 *
 * The rules that do not vary:
 *   - the image leads, and owns roughly two thirds of the card;
 *   - the title is two lines, then it clamps, so a long name cannot make one
 *     card taller than the one beside it and break the grid's rhythm;
 *   - the price is the largest text under the image;
 *   - one secondary line, not five.
 */

export type ProductCardMedia = {
  /** Rendered by the caller so each surface keeps its own image pipeline. */
  node: React.ReactNode;
  /** Cover ratio. Books are portrait; goods and services are landscape. */
  ratio: "square" | "landscape" | "portrait";
};

const RATIO_CLASS = {
  square: "aspect-square",
  landscape: "aspect-[4/3]",
  portrait: "aspect-[3/4]",
} as const;

export type ProductCardBadge = {
  label: string;
  /** `accent` is Kondo green and is reserved for the state that matters most. */
  tone?: "neutral" | "accent";
};

export function ProductCard({
  href,
  title,
  media,
  price,
  secondary,
  footer,
  badges = [],
  action,
  className,
}: {
  href: string;
  title: string;
  media: ProductCardMedia;
  /** Already formatted — "¥299", "Contact for price", "In your library". */
  price: React.ReactNode;
  /** One short fact: condition, format, availability. */
  secondary?: React.ReactNode;
  /** Seller, provider or organization. Rendered smallest. */
  footer?: React.ReactNode;
  badges?: ProductCardBadge[];
  /** Favourite or save. Sits over the image, outside the link. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground",
        // Press feedback rather than a hover lift: this is a touch surface
        // first, and a card that jumps on tap feels unsteady under a thumb.
        "transition duration-200 active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100",
        "hover:border-kondo-green/30 hover:shadow-soft",
        className,
      )}
    >
      <div
        className={cn(
          "relative w-full overflow-hidden bg-muted",
          RATIO_CLASS[media.ratio],
        )}
      >
        {media.node}
        {badges.length ? (
          <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
            {badges.slice(0, 2).map((badge) => (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] backdrop-blur",
                  badge.tone === "accent"
                    ? "bg-kondo-green text-white"
                    : "bg-background/85 text-foreground",
                )}
                key={badge.label}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
        {action ? (
          <div className="absolute right-1.5 top-1.5 z-20">{action}</div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        {/*
         * The whole card is the target. A stretched link keeps that true
         * without nesting the favourite button inside an anchor, which would
         * make one control swallow the other's taps.
         */}
        <h3 className="line-clamp-2 text-[13px] font-bold leading-snug text-foreground sm:text-sm">
          <Link className="after:absolute after:inset-0" href={href}>
            {title}
          </Link>
        </h3>
        <p className="text-[15px] font-black leading-none tracking-tight text-foreground sm:text-base">
          {price}
        </p>
        {secondary ? (
          <p className="truncate text-[11px] text-muted-foreground">
            {secondary}
          </p>
        ) : null}
        {footer ? (
          <p className="mt-auto truncate pt-1 text-[11px] text-muted-foreground">
            {footer}
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * The grid every commerce surface hangs off.
 *
 * Two columns on a phone is the point of the whole exercise — one product per
 * row turns browsing into scrolling. It widens from there rather than starting
 * wide and squeezing down.
 */
export function ProductGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Holds the grid's shape while products load, so nothing reflows under the thumb. */
export function ProductCardSkeleton({
  ratio = "landscape",
}: {
  ratio?: ProductCardMedia["ratio"];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div
        className={cn("w-full animate-pulse bg-muted", RATIO_CLASS[ratio])}
      />
      <div className="space-y-2 p-2.5 sm:p-3">
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 8,
  ratio = "landscape",
}: {
  count?: number;
  ratio?: ProductCardMedia["ratio"];
}) {
  return (
    <ProductGrid>
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} ratio={ratio} />
      ))}
    </ProductGrid>
  );
}
