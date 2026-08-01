import Link from "next/link";
import { BadgeCheck, MapPin, Store, UtensilsCrossed } from "lucide-react";
import { ClampedTitle, ExpandableText } from "@/components/ui/ClampedText";
import { Card } from "@/components/ui/Card";
import { MARKETPLACE_SOURCE_LABELS } from "@/features/marketplace/sections";
import type { PublicCatalogItem } from "@/lib/organization-catalog";

/**
 * Food & Services: a curated projection of real Organization Products and
 * Organization Services.
 *
 * There is no Food & Services table. Records are read through the catalog's own
 * public projection, so an unpublished resource, a blocked external URL or a
 * suspended organization vanishes here at exactly the moment it vanishes from
 * the organization's public page.
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
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Every card states what kind of thing it is, so a business
                      can never be mistaken for a student offer. */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-kondo-green/10 px-2.5 py-1 text-xs font-bold text-kondo-green">
                    <UtensilsCrossed
                      aria-hidden="true"
                      className="h-3.5 w-3.5"
                    />
                    {item.kind === "product"
                      ? MARKETPLACE_SOURCE_LABELS["organization-product"]
                      : MARKETPLACE_SOURCE_LABELS["organization-service"]}
                  </span>
                  {item.category ? (
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      {item.category}
                    </span>
                  ) : null}
                </div>

                <h2 className="mt-3 text-base font-black leading-snug">
                  <Link className="hover:underline" href={item.href}>
                    <ClampedTitle>{item.title}</ClampedTitle>
                  </Link>
                </h2>

                {item.shortDescription ? (
                  <ExpandableText
                    className="mt-1.5 text-sm leading-6 text-muted-foreground"
                    lines={4}
                    text={item.shortDescription}
                  />
                ) : null}

                <dl className="mt-4 space-y-1.5 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <dt className="sr-only">Publisher</dt>
                    <dd className="font-semibold">{item.organization.name}</dd>
                    {item.organization.verified ? (
                      <BadgeCheck
                        aria-label="Verified organization"
                        className="h-4 w-4 text-kondo-green"
                      />
                    ) : null}
                  </div>
                  {/* City or publisher-declared area only — never an address. */}
                  {item.city?.name || item.locationLabel ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <dt className="sr-only">Area</dt>
                      <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                      <dd>{item.city?.name ?? item.locationLabel}</dd>
                    </div>
                  ) : null}
                  {/* Price and availability are shown only when the publisher
                      actually stated them. Nothing is invented. */}
                  {item.priceLabel ? (
                    <div className="text-muted-foreground">
                      <dt className="sr-only">Price</dt>
                      <dd>{item.priceLabel}</dd>
                    </div>
                  ) : null}
                  {item.availabilityLabel ? (
                    <div className="text-muted-foreground">
                      <dt className="sr-only">Availability</dt>
                      <dd>{item.availabilityLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <div className="mt-auto pt-5">
                  <Link
                    className="inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-black text-secondary-foreground transition hover:bg-secondary/75"
                    href={item.href}
                  >
                    View details
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
