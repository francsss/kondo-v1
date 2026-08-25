import { Store } from "lucide-react";
import { CatalogCard } from "@/components/features/catalog/CatalogCard";
import { ProductGrid } from "@/components/features/commerce/ProductCard";
import { Card } from "@/components/ui/Card";
import type { PublicCatalogItem } from "@/lib/organization-catalog";

/**
 * Food & Services: a curated projection of real Organization Products and
 * Organization Services.
 *
 * There is no Food & Services table. Records are read through the catalog's own
 * public projection, so an unpublished resource, a blocked external URL or a
 * suspended organization vanishes here at exactly the moment it vanishes from
 * the organization's public page.
 *
 * The items are drawn on `CatalogCard`, the same card the organization's own
 * storefront and Discover use. This section drew its own card instead, and
 * that card had no image in it at all — a restaurant could upload a photo of
 * the dish, publish it, and the one place students browse for food would show
 * a paragraph of text where the photo should be. Nothing was wrong with the
 * upload; the picture was simply never asked for. Sharing the card also means
 * a photo taken for one surface cannot be missing from another later.
 */
export function FoodAndServicesBoard({
  products,
  services,
}: {
  products: PublicCatalogItem[];
  services: PublicCatalogItem[];
}) {
  // Services first: they are what students look for most in this section.
  const items = [...services, ...products];

  return (
    <section aria-labelledby="food-services-heading">
      <div className="max-w-2xl">
        <h1
          className="font-display text-3xl font-black sm:text-4xl"
          id="food-services-heading"
        >
          Food &amp; Services
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Restaurants, shops and professional services published by
          organizations on Kondo. Every listing below is published by a
          registered organization, not by an individual student.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="mt-8 py-16 text-center">
          <Store className="mx-auto h-9 w-9 text-kondo-green" />
          <h2 className="mt-4 text-xl font-black">
            No food or services published yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Organizations publish restaurants, shops and local services here.
            Nothing matches your filters right now.
          </p>
        </Card>
      ) : (
        <ProductGrid className="mt-8">
          {items.map((item, index) => (
            <CatalogCard
              item={item}
              key={`${item.kind}-${item.id}`}
              // The first row is above the fold on every viewport.
              priority={index < 2}
            />
          ))}
        </ProductGrid>
      )}
    </section>
  );
}
