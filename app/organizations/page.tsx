import type {
  OrganizationCapabilityKey,
  OrganizationType,
} from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { OrganizationDirectoryAnalytics } from "@/components/organizations/OrganizationDirectoryAnalytics";
import { OrganizationPublicChrome } from "@/components/organizations/OrganizationPublicChrome";
import {
  ORGANIZATION_CAPABILITIES,
  ORGANIZATION_CAPABILITY_KEYS,
} from "@/lib/organization-capabilities";
import { listPublicOrganizations } from "@/lib/organization-public-profile";
import { getOrganizationReferenceData } from "@/lib/reference-data";
import {
  ORGANIZATION_TYPE_KEYS,
  ORGANIZATION_TYPES,
} from "@/features/organizations/registry";

export const metadata: Metadata = {
  title: "Organizations",
  description:
    "Discover public organizations supporting international students and alumni across the Kondo ecosystem.",
  alternates: { canonical: "/organizations" },
  openGraph: {
    title: "Organizations on Kondo",
    description:
      "Discover public organizations, trusted partners and student services.",
    url: "/organizations",
  },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validType(value: string | undefined) {
  return ORGANIZATION_TYPE_KEYS.includes(value as OrganizationType)
    ? (value as OrganizationType)
    : undefined;
}

function validCapability(value: string | undefined) {
  return ORGANIZATION_CAPABILITY_KEYS.includes(
    value as OrganizationCapabilityKey,
  )
    ? (value as OrganizationCapabilityKey)
    : undefined;
}

export default async function OrganizationsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const queryState = await searchParams;
  const query = first(queryState.q)?.trim().slice(0, 100) ?? "";
  const type = validType(first(queryState.type));
  const capability = validCapability(first(queryState.capability));
  const cityId = first(queryState.city) || undefined;
  const countryId = first(queryState.country) || undefined;
  const verification =
    first(queryState.verification) === "VERIFIED"
      ? ("VERIFIED" as const)
      : undefined;
  const partner = first(queryState.partner) === "true";
  const page = Math.max(
    1,
    Number.parseInt(first(queryState.page) || "1", 10) || 1,
  );
  const [directory, references] = await Promise.all([
    listPublicOrganizations({
      query,
      type,
      capability,
      cityId,
      countryId,
      verification,
      partner,
      page,
    }),
    getOrganizationReferenceData(),
  ]);
  const filterCategories = [
    query ? "query" : null,
    type ? "type" : null,
    capability ? "capability" : null,
    cityId ? "city" : null,
    countryId ? "country" : null,
    verification ? "verification" : null,
    partner ? "partner" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-dvh bg-background">
      <OrganizationDirectoryAnalytics
        filterCategories={filterCategories}
        filtered={filterCategories.length > 0}
        resultCount={directory.total}
      />
      <OrganizationPublicChrome />
      <main>
        <section className="overflow-hidden border-b border-border bg-kondo-forest text-white">
          <div className="mx-auto max-w-[1240px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-kondo-lime">
              <Building2 className="h-4 w-4" />
              Kondo ecosystem
            </p>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-black tracking-[-0.04em] sm:text-6xl">
              Find organizations that can move your journey forward.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              Explore public profiles from universities, associations, employers
              and student service organizations. Verification and partnership
              are always shown separately.
            </p>
          </div>
        </section>

        <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
          <form className="grid gap-3 rounded-[2rem] border border-border bg-card p-4 shadow-sm sm:p-5 lg:grid-cols-12">
            <label className="relative lg:col-span-4">
              <span className="sr-only">Search organizations</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-12 w-full rounded-2xl border border-border bg-background pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
                defaultValue={query}
                name="q"
                placeholder="Search by name, city or activity"
              />
            </label>
            <DirectorySelect
              className="lg:col-span-2"
              defaultValue={type}
              label="Organization type"
              name="type"
            >
              <option value="">All types</option>
              {ORGANIZATION_TYPES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </DirectorySelect>
            <DirectorySelect
              className="lg:col-span-2"
              defaultValue={capability}
              label="Activity area"
              name="capability"
            >
              <option value="">All activities</option>
              {ORGANIZATION_CAPABILITIES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </DirectorySelect>
            <DirectorySelect
              className="lg:col-span-2"
              defaultValue={countryId}
              label="Country"
              name="country"
            >
              <option value="">All countries</option>
              {references.countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.emoji ?? ""} {country.name}
                </option>
              ))}
            </DirectorySelect>
            <DirectorySelect
              className="lg:col-span-2"
              defaultValue={cityId}
              label="City"
              name="city"
            >
              <option value="">All cities</option>
              {references.cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} · {city.country.name}
                </option>
              ))}
            </DirectorySelect>
            <div className="flex flex-wrap items-center gap-3 lg:col-span-9">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-black">
                <input
                  defaultChecked={verification === "VERIFIED"}
                  name="verification"
                  type="checkbox"
                  value="VERIFIED"
                />
                Verified only
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-black">
                <input
                  defaultChecked={partner}
                  name="partner"
                  type="checkbox"
                  value="true"
                />
                Official partners
              </label>
              {query ||
              type ||
              capability ||
              cityId ||
              countryId ||
              verification ||
              partner ? (
                <Link
                  className="text-xs font-black text-muted-foreground hover:text-kondo-green"
                  href="/organizations"
                >
                  Clear filters
                </Link>
              ) : null}
            </div>
            <button
              className="h-11 rounded-full bg-kondo-forest px-6 text-sm font-black text-white transition hover:bg-kondo-green lg:col-span-3"
              type="submit"
            >
              Explore organizations
            </button>
          </form>

          <div className="mt-8 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-kondo-green">
                Public profiles
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {directory.total} organization
                {directory.total === 1 ? "" : "s"}
              </h2>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Page {directory.page} of {directory.pageCount}
            </p>
          </div>

          {directory.organizations.length ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directory.organizations.map((organization) => (
                <Link
                  className="group overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:border-kondo-green/50 hover:shadow-xl motion-reduce:transform-none"
                  href={`/organizations/${organization.slug}`}
                  key={organization.id}
                >
                  <div className="relative h-28 overflow-hidden bg-kondo-forest">
                    {organization.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        className="h-full w-full object-cover opacity-70 transition duration-500 group-hover:scale-105"
                        src={organization.cover.url}
                      />
                    ) : (
                      <div className="h-full bg-[radial-gradient(circle_at_10%_10%,rgba(210,255,112,0.25),transparent_45%)]" />
                    )}
                    {organization.trust.partner.active ? (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-kondo-lime px-2.5 py-1 text-[10px] font-black uppercase text-kondo-forest">
                        <Sparkles className="h-3 w-3" />
                        Partner
                      </span>
                    ) : null}
                  </div>
                  <div className="relative p-5 pt-10">
                    <div className="absolute -top-8 left-5 grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-kondo-mint font-black text-kondo-forest">
                      {organization.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={organization.logo.altText}
                          className="h-full w-full object-cover"
                          src={organization.logo.url}
                        />
                      ) : (
                        organization.publicName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="truncate text-lg font-black">
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
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] text-kondo-green">
                      {organization.organizationTypeLabel}
                    </p>
                    <p className="mt-3 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-muted-foreground">
                      {organization.shortDescription ||
                        organization.tagline ||
                        "Open this public profile to learn more."}
                    </p>
                    {organization.publicCapabilities.length ? (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {organization.publicCapabilities
                          .slice(0, 2)
                          .map((key) => (
                            <span
                              className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground"
                              key={key}
                            >
                              {ORGANIZATION_CAPABILITIES.find(
                                (capability) => capability.key === key,
                              )?.label ?? key.replaceAll("_", " ")}
                            </span>
                          ))}
                      </div>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {organization.city?.name || organization.country.name}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-kondo-green transition group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-[2rem] border border-dashed border-border bg-card px-6 py-16 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-black">
                No public profiles match these filters
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Try a broader activity, location or organization type. Private
                and unpublished profiles are never shown here.
              </p>
            </div>
          )}

          {directory.pageCount > 1 ? (
            <nav
              aria-label="Organization directory pages"
              className="mt-8 flex items-center justify-center gap-3"
            >
              <PaginationLink
                disabled={directory.page <= 1}
                direction="previous"
                page={directory.page - 1}
                queryState={queryState}
              />
              <span className="text-sm font-black">
                {directory.page} / {directory.pageCount}
              </span>
              <PaginationLink
                disabled={directory.page >= directory.pageCount}
                direction="next"
                page={directory.page + 1}
                queryState={queryState}
              />
            </nav>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function DirectorySelect({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="sr-only">{label}</span>
      <select
        {...props}
        className="h-12 w-full rounded-2xl border border-border bg-background px-3 text-sm font-semibold outline-none transition focus:border-kondo-green focus:ring-4 focus:ring-kondo-green/10"
      >
        {children}
      </select>
    </label>
  );
}

function PaginationLink({
  disabled,
  direction,
  page,
  queryState,
}: {
  disabled: boolean;
  direction: "previous" | "next";
  page: number;
  queryState: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryState)) {
    if (key === "page" || !value) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else {
      params.set(key, value);
    }
  }
  params.set("page", String(page));
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  const label = direction === "previous" ? "Previous" : "Next";
  return disabled ? (
    <span className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-black text-muted-foreground opacity-40">
      <Icon className="h-4 w-4" />
      {label}
    </span>
  ) : (
    <Link
      className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
      href={`/organizations?${params.toString()}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
