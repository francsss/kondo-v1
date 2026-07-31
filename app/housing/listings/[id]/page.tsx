import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  ChevronLeft,
  Clock3,
  MapPin,
  Maximize2,
  ShieldCheck,
  Sofa,
  Users,
} from "lucide-react";
import { HousingListingActions } from "@/components/features/housing/HousingListingActions";
import {
  HOUSING_ANALYTICS_EVENTS,
  HousingAnalytics,
} from "@/components/features/housing/HousingAnalytics";
import { HousingMap } from "@/components/features/housing/HousingMap";
import { PostMediaGallery } from "@/components/features/community/PostMediaGallery";
import { OrganizationPublicChrome } from "@/components/organizations/OrganizationPublicChrome";
import { Card } from "@/components/ui/Card";
import { getPublicHousingListing } from "@/lib/housing-listings";
import { getCurrentUser } from "@/lib/server-auth";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getPublicHousingListing((await params).id);
  if (!listing)
    return { title: "Housing listing not found", robots: "noindex" };
  const image = listing.media[0];
  return {
    title: listing.title,
    description: listing.shortDescription,
    alternates: { canonical: `/housing/listings/${listing.slug}` },
    openGraph: {
      title: listing.title,
      description: listing.shortDescription,
      images: image ? [`/api/media/${image.mediaId}`] : undefined,
    },
  };
}

function money(amountMinor: number | null, currency: string) {
  if (amountMinor == null) return "Not specified";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export default async function HousingListingPage({ params }: Props) {
  const user = await getCurrentUser();
  const listing = await getPublicHousingListing((await params).id, user?.id);
  if (!listing) notFound();
  return (
    <>
      <OrganizationPublicChrome backHref="/housing" backLabel="Kondo Housing" />
      <main className="mx-auto max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-16 lg:pt-8">
        <HousingAnalytics
          disabled={Boolean(user)}
          event={HOUSING_ANALYTICS_EVENTS.HOUSING_LISTING_VIEWED}
          properties={{
            listing_type: listing.type,
            publisher_type: listing.publisher.type,
            city_id: listing.location.city.id,
          }}
        />
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"
          href="/housing/search"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
          Back to Housing
        </Link>
        <PostMediaGallery
          galleryLabel="Housing gallery"
          immersive
          media={listing.media.map((item) => ({
            media: { id: item.mediaId, altText: item.altText },
          }))}
        />

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-kondo-green/10 px-3 py-1 text-xs font-black text-kondo-green">
                  {listing.typeLabel}
                </span>
                <h1 className="mt-3 max-w-3xl font-display text-3xl font-black leading-tight sm:text-4xl">
                  {listing.title}
                </h1>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin aria-hidden className="h-4 w-4" />
                  {listing.location.label}, {listing.location.city.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-kondo-green">
                  {money(
                    listing.price.monthlyRentMinor,
                    listing.price.currency,
                  )}
                </p>
                <p className="text-xs font-bold text-muted-foreground">
                  per month
                </p>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  icon: BedDouble,
                  value:
                    listing.property.bedrooms == null
                      ? "—"
                      : `${listing.property.bedrooms} bedrooms`,
                },
                {
                  icon: Users,
                  value: `${listing.property.availablePlaces} places`,
                },
                {
                  icon: CalendarDays,
                  value: listing.availability.availableFrom
                    ? `From ${new Date(listing.availability.availableFrom).toLocaleDateString("en", { month: "short", day: "numeric" })}`
                    : "Flexible date",
                },
                {
                  icon: ShieldCheck,
                  value: "Privacy-safe location",
                },
              ].map(({ icon: Icon, value }) => (
                <Card className="rounded-2xl p-4" key={value}>
                  <Icon aria-hidden className="h-5 w-5 text-kondo-green" />
                  <p className="mt-2 text-sm font-bold">{value}</p>
                </Card>
              ))}
            </div>

            <section className="mt-8">
              <h2 className="font-display text-2xl font-black">
                About this home
              </h2>
              <p className="mt-3 whitespace-pre-wrap leading-7 text-muted-foreground">
                {listing.description}
              </p>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-2xl font-black">
                Property details
              </h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: BedDouble,
                    label: "Bedrooms",
                    value: listing.property.bedrooms ?? "Not specified",
                  },
                  {
                    icon: Bath,
                    label: "Bathrooms",
                    value: listing.property.bathrooms ?? "Not specified",
                  },
                  {
                    icon: Maximize2,
                    label: "Size",
                    value: listing.property.sizeSquareMeters
                      ? `${listing.property.sizeSquareMeters} m²`
                      : "Not specified",
                  },
                  {
                    icon: Sofa,
                    label: "Furnishing",
                    value: listing.property.furnishing
                      .toLowerCase()
                      .replaceAll("_", " "),
                  },
                  {
                    icon: Building2,
                    label: "Floor",
                    value: listing.property.floor ?? "Not specified",
                  },
                  {
                    icon: Clock3,
                    label: "Minimum stay",
                    value: listing.availability.minimumStayMonths
                      ? `${listing.availability.minimumStayMonths} months`
                      : "Not specified",
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                    key={label}
                  >
                    <Icon
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-kondo-green"
                    />
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">
                        {label}
                      </dt>
                      <dd className="mt-0.5 text-sm font-black capitalize">
                        {value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>

            {listing.amenities.length ? (
              <section className="mt-8">
                <h2 className="font-display text-2xl font-black">Amenities</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {listing.amenities.map((amenity) => (
                    <span
                      className="rounded-full border border-border bg-card px-4 py-2 text-sm font-bold"
                      key={amenity}
                    >
                      {amenity.toLowerCase().replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              <Card>
                <h2 className="font-display text-lg font-black">Costs</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ["Deposit", listing.price.depositMinor],
                    ["Utilities", listing.price.utilitiesMinor],
                    ["Agency fee", listing.price.agencyFeeMinor],
                    ["Service fee", listing.price.serviceFeeMinor],
                  ].map(([label, value]) => (
                    <div
                      className="flex justify-between gap-4"
                      key={String(label)}
                    >
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-bold">
                        {money(value as number | null, listing.price.currency)}
                      </dd>
                    </div>
                  ))}
                </dl>
                {[
                  listing.price.depositMinor,
                  listing.price.utilitiesMinor,
                  listing.price.agencyFeeMinor,
                  listing.price.serviceFeeMinor,
                ].some((value) => value == null) ? (
                  <p className="mt-4 rounded-2xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">
                    Some costs are not specified. Confirm the full amount and
                    payment schedule with the publisher before agreeing.
                  </p>
                ) : null}
              </Card>
              <Card>
                <h2 className="font-display text-lg font-black">Publisher</h2>
                <div className="mt-4 flex items-center gap-2">
                  <p className="font-bold">{listing.publisher.name}</p>
                  {listing.publisher.verified ? (
                    <BadgeCheck
                      aria-label="Verified publisher"
                      className="h-5 w-5 text-kondo-green"
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {listing.publisher.type === "ORGANIZATION"
                    ? "Published by an organization on Kondo."
                    : "Published by a Kondo member under the personal Housing policy."}
                </p>
                {listing.publisher.partner ? (
                  <p className="mt-2 text-xs font-black text-kondo-green">
                    Official Kondo partner
                  </p>
                ) : null}
                {listing.publisher.href ? (
                  <Link
                    className="mt-3 inline-block text-sm font-black text-kondo-green hover:underline"
                    href={listing.publisher.href}
                  >
                    View profile
                  </Link>
                ) : null}
              </Card>
            </section>

            <section className="mt-8">
              <h2 className="font-display text-2xl font-black">Location</h2>
              <Card className="mt-4 overflow-hidden p-0">
                {listing.location.mapPoint ? (
                  <HousingMap
                    compact
                    points={[
                      {
                        id: listing.id,
                        title: listing.title,
                        locationLabel: listing.location.label,
                        href: `/housing/listings/${listing.slug}`,
                        coordinate: listing.location.mapPoint,
                        price: {
                          amountMinor: listing.price.monthlyRentMinor,
                          currency: listing.price.currency,
                        },
                      },
                    ]}
                  />
                ) : (
                  <div className="p-5">
                    <MapPin aria-hidden className="h-6 w-6 text-kondo-green" />
                    <p className="mt-3 font-black">
                      {listing.location.label}, {listing.location.city.name}
                    </p>
                  </div>
                )}
                <div className="border-t border-border p-5">
                  <p className="text-sm font-black">{listing.location.label}</p>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    This is a privacy-safe location. Exact unit numbers and
                    access details are never displayed publicly. Ask the
                    publisher privately before arranging a visit.
                  </p>
                  {listing.transportContext ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {listing.transportContext}
                    </p>
                  ) : null}
                  {listing.neighborhoodContext ? (
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {listing.neighborhoodContext}
                    </p>
                  ) : null}
                </div>
              </Card>
            </section>

            <section className="mt-8 rounded-3xl border border-amber-300/40 bg-amber-50/70 p-5 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              <h2 className="flex items-center gap-2 font-display text-xl font-black">
                <AlertTriangle aria-hidden className="h-5 w-5" />
                Rent safely
              </h2>
              <ul className="mt-3 grid gap-2 text-sm leading-6 sm:grid-cols-2">
                <li>Inspect the property where possible.</li>
                <li>Confirm the address and contract before payment.</li>
                <li>Verify deposit and refund conditions.</li>
                <li>Report pressure, suspicious prices or unsafe behavior.</li>
              </ul>
              <p className="mt-3 text-xs opacity-75">
                This practical guidance is not legal advice, and identity review
                does not guarantee a property or transaction.
              </p>
            </section>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="p-4 sm:p-5">
              <HousingListingActions
                initialSaved={listing.saved}
                listingId={listing.id}
                signedIn={Boolean(user)}
              />
            </Card>
            <p className="mt-4 px-3 text-xs leading-5 text-muted-foreground">
              Never transfer money before verifying the property and agreement.
              Kondo does not guarantee off-platform payments.
            </p>
          </aside>
        </div>
      </main>
    </>
  );
}
