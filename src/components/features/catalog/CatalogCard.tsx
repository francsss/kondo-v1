import { Package, Sparkles } from "lucide-react";
import { ProductCard } from "@/components/features/commerce/ProductCard";
import type { PublicCatalogItem } from "@/lib/organization-catalog";

/**
 * An organization's product or service on the shared commerce card.
 *
 * It used to carry a category eyebrow, a two-line title, a three-line
 * description, the price, the organization, the location and a "View details"
 * call to action — seven pieces of furniture around one photo. In a grid,
 * nobody reads the description; they look at the picture and the price and
 * decide whether to open it. The description belongs on the detail page, which
 * is one tap away and where there is room to read it.
 *
 * `priceLabel` is passed through exactly as the catalogue produced it, so an
 * item genuinely priced on request still says "Contact for price" rather than
 * being given a number it does not have.
 */
export function CatalogCard({
  item,
  priority = false,
}: {
  item: PublicCatalogItem;
  priority?: boolean;
}) {
  const Icon = item.kind === "product" ? Package : Sparkles;
  const place = item.locationLabel ?? item.city?.name;

  return (
    <ProductCard
      badges={[{ label: item.kind }]}
      footer={item.organization.name}
      href={item.href}
      media={{
        ratio: "landscape",
        node: item.media[0] ? (
          // The authenticated media route is intentionally rendered directly.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={item.media[0].altText}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            loading={priority ? "eager" : "lazy"}
            src={item.media[0].url}
          />
        ) : (
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-kondo-mint to-emerald-50 dark:from-emerald-400/10 dark:to-transparent">
            <Icon aria-hidden="true" className="h-8 w-8 text-kondo-green/45" />
          </span>
        ),
      }}
      price={item.priceLabel}
      secondary={place ?? item.category}
      title={item.title}
    />
  );
}
