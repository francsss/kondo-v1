import Link from "next/link";
import { ArrowRight, Building2, MapPin, Sparkles } from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import type { OrganizationPublicProfileDTO } from "@/lib/organization-public-profile";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function OrganizationCityRail({
  cityName,
  organizations,
}: {
  cityName: string;
  organizations: OrganizationPublicProfileDTO[];
}) {
  if (!organizations.length) return null;
  return (
    <section className="mt-10" aria-labelledby="city-organizations-title">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Live Kondo identities
          </p>
          <h2
            className="mt-2 text-2xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white sm:text-3xl"
            id="city-organizations-title"
          >
            Organizations in {cityName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Public organization profiles are shown separately from Kondo’s
            editorial city recommendations.
          </p>
        </div>
        <Link
          className="hidden items-center gap-1 text-sm font-black text-kondo-green sm:inline-flex"
          href="/organizations"
        >
          View directory <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-3 [scrollbar-width:none]">
        {organizations.map((organization) => (
          <Link
            className="group w-[280px] shrink-0 snap-start overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
            data-product-destination={organization.organizationType}
            data-product-event={PRODUCT_EVENTS.ORGANIZATION_CITY_CONTEXT_OPENED}
            data-product-source={cityName}
            href={`/organizations/${organization.slug}`}
            key={organization.id}
          >
            <div className="relative h-24 bg-kondo-forest">
              {organization.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt=""
                  className="h-full w-full object-cover opacity-70"
                  loading="lazy"
                  src={organization.cover.url}
                />
              ) : null}
              {organization.trust.partner.active ? (
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-kondo-lime px-2 py-1 text-[9px] font-black uppercase text-kondo-forest">
                  <Sparkles className="h-2.5 w-2.5" />
                  Partner
                </span>
              ) : null}
            </div>
            <div className="relative p-4 pt-8">
              <span className="absolute -top-6 left-4 grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-kondo-mint text-xs font-black text-kondo-forest">
                {organization.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={organization.logo.altText}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    src={organization.logo.url}
                  />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
              </span>
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate font-black">
                  {organization.publicName}
                </h3>
                {organization.trust.verification.state === "VERIFIED" ? (
                  <OfficialMark
                    interactive={false}
                    organizationName={organization.publicName}
                    organizationType={organization.organizationType}
                  />
                ) : null}
              </div>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.08em] text-kondo-green">
                {organization.organizationTypeLabel}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {organization.city?.name || cityName}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
