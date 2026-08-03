import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  Globe2,
  House,
  Languages,
  MapPin,
  Package,
  ConciergeBell,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { OfficialMark } from "@/components/features/official-profile/OfficialMark";
import { OrganizationGallery } from "@/components/organizations/OrganizationGallery";
import { OrganizationPublicActions } from "@/components/organizations/OrganizationPublicActions";
import { OrganizationPublicAnalytics } from "@/components/organizations/OrganizationPublicAnalytics";
import { OrganizationSectionNavigation } from "@/components/organizations/OrganizationSectionNavigation";
import { TabPanelTransition } from "@/components/ui/HorizontalTabs";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organization-capabilities";
import type { OrganizationPublicProfileDTO } from "@/lib/organization-public-profile";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function OrganizationPublicPage({
  organization,
  preview = false,
  activeSection,
}: {
  organization: OrganizationPublicProfileDTO;
  preview?: boolean;
  activeSection?: string;
}) {
  const Root = preview ? "div" : "main";
  const capabilityMetadata = organization.publicCapabilities.flatMap((key) => {
    const capability = ORGANIZATION_CAPABILITIES.find(
      (candidate) => candidate.key === key,
    );
    return capability ? [capability] : [];
  });
  const resolvedActiveSection =
    organization.visibleSections.find(({ key }) => key === activeSection)
      ?.key ??
    organization.visibleSections[0]?.key ??
    "overview";
  const sectionIds = new Set(
    preview
      ? organization.visibleSections.map(({ key }) => key)
      : [resolvedActiveSection],
  );
  const activeSectionIndex = Math.max(
    0,
    organization.visibleSections.findIndex(
      ({ key }) => key === resolvedActiveSection,
    ),
  );
  const location = [
    organization.city?.name,
    organization.city?.province,
    organization.country?.name,
  ]
    .filter(Boolean)
    .join(", ");
  /**
   * What this organization actually publishes, stated in the hero so the
   * first impression answers "what do they offer?" before any tab is opened.
   * Ordered exactly like the tabs, which are already adapted to the type.
   */
  const offerings = organization.visibleSections.flatMap((section) => {
    const projection = organization.projections[section.key];
    if (!projection?.itemCount) return [];
    return [
      { key: section.key, label: section.label, count: projection.itemCount },
    ];
  });

  return (
    <Root
      className="min-h-dvh bg-background text-foreground"
      data-testid="organization-public-profile"
    >
      <OrganizationPublicAnalytics
        organizationType={organization.organizationType}
        partner={organization.trust.partner.active}
        preview={preview}
        verificationState={organization.trust.verification.state}
      />
      {preview ? (
        <div className="sticky top-16 z-30 border-b border-amber-200 bg-amber-50/95 px-4 py-2 text-center text-xs font-black text-amber-950 backdrop-blur dark:border-amber-400/20 dark:bg-amber-950/90 dark:text-amber-100">
          Private preview — only organization members can see this version.
        </div>
      ) : null}

      <section className="relative isolate overflow-hidden bg-kondo-forest text-white">
        <div className="absolute inset-0 -z-20">
          {organization.cover ? (
            // The media endpoint enforces publication visibility itself.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={organization.cover.altText}
              className="h-full w-full object-cover opacity-45"
              src={organization.cover.url}
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_20%_0%,rgba(210,255,112,0.22),transparent_38%),radial-gradient(circle_at_90%_70%,rgba(67,215,176,0.2),transparent_35%)]" />
          )}
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-kondo-forest via-kondo-forest/80 to-kondo-forest/25" />

        <div className="mx-auto flex min-h-[430px] max-w-[1240px] flex-col justify-end px-4 pb-8 pt-24 sm:px-6 sm:pb-12 lg:px-8">
          <div className="flex flex-col items-start gap-5 md:flex-row md:items-end">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-[1.75rem] border-4 border-white/90 bg-kondo-lime text-2xl font-black text-kondo-forest shadow-2xl sm:h-28 sm:w-28">
              {organization.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={organization.logo.altText}
                  className="h-full w-full object-cover"
                  src={organization.logo.url}
                />
              ) : (
                initials(organization.publicName)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/85 backdrop-blur">
                  {organization.organizationTypeLabel}
                </p>
                {organization.trust.partner.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-kondo-lime px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-kondo-forest">
                    <Sparkles className="h-3 w-3" />
                    Official Kondo partner
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <h1 className="min-w-0 text-balance text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                  {organization.publicName}
                </h1>
                {organization.trust.verification.state === "VERIFIED" ? (
                  <OfficialMark
                    className="text-white hover:bg-white/10 dark:text-white"
                    organizationName={organization.publicName}
                    organizationType={organization.organizationType}
                    size="md"
                  />
                ) : null}
              </div>
              {organization.tagline ? (
                <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-white/80 sm:text-lg">
                  {organization.tagline}
                </p>
              ) : null}
              {!organization.tagline && organization.shortDescription ? (
                <p className="mt-3 line-clamp-3 max-w-3xl text-base leading-7 text-white/75">
                  {organization.shortDescription}
                </p>
              ) : null}
              {location ? (
                <p className="mt-3 flex items-center gap-2 text-sm font-bold text-white/65">
                  <MapPin className="h-4 w-4" />
                  {location}
                </p>
              ) : null}
              {offerings.length ? (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {offerings.map((offering) => (
                    <li key={offering.key}>
                      <a
                        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-black text-white backdrop-blur transition hover:border-kondo-lime hover:bg-white/20"
                        href={`?section=${encodeURIComponent(offering.key)}`}
                      >
                        <span className="tabular-nums">{offering.count}</span>
                        {offering.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="w-full md:w-auto">
              <OrganizationPublicActions organization={organization} />
            </div>
          </div>
        </div>
      </section>

      {organization.visibleSections.length ? (
        <OrganizationSectionNavigation
          activeSection={resolvedActiveSection}
          sections={organization.visibleSections.map((section) => ({
            key: section.key,
            label: section.label,
            accessibilityLabel: section.accessibilityLabel,
          }))}
        />
      ) : null}

      <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-8 sm:px-6 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8">
        <TabPanelTransition
          className="min-w-0 space-y-6"
          index={activeSectionIndex}
        >
          {sectionIds.has("overview") ? (
            <PublicSection
              description="A quick, public overview shared by the organization."
              icon={Sparkles}
              id="overview"
              title="Overview"
            >
              {organization.shortDescription ? (
                <p className="text-base leading-8 text-muted-foreground sm:text-lg">
                  {organization.shortDescription}
                </p>
              ) : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {organization.serviceAreas.length ? (
                  <Fact
                    icon={Globe2}
                    label="Service areas"
                    value={organization.serviceAreas.join(" · ")}
                  />
                ) : null}
                {organization.publicGeneralAddress ? (
                  <Fact
                    icon={MapPin}
                    label="Public address"
                    value={organization.publicGeneralAddress}
                  />
                ) : null}
                {organization.supportedLanguages.length ? (
                  <Fact
                    icon={Languages}
                    label="Languages"
                    value={organization.supportedLanguages.join(" · ")}
                  />
                ) : null}
              </div>
            </PublicSection>
          ) : null}

          {sectionIds.has("about") ? (
            <PublicSection
              description="Background information provided by the organization."
              icon={Building2}
              id="about"
              title="About"
            >
              {organization.extendedDescription ? (
                <div className="whitespace-pre-wrap text-base leading-8 text-muted-foreground">
                  {organization.extendedDescription}
                </div>
              ) : null}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {organization.foundedYear ? (
                  <Fact
                    icon={CalendarDays}
                    label="Founded"
                    value={String(organization.foundedYear)}
                  />
                ) : null}
                {organization.organizationSizeRange ? (
                  <Fact
                    icon={Users}
                    label="Organization size"
                    value={organization.organizationSizeRange}
                  />
                ) : null}
              </div>
            </PublicSection>
          ) : null}

          {sectionIds.has("capabilities") ? (
            <PublicSection
              description="The areas this organization supports on Kondo."
              icon={CheckCircle2}
              id="capabilities"
              title="Activity areas"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {capabilityMetadata.map((capability) => {
                  const Icon = capability.icon;
                  return (
                    <div
                      className="rounded-3xl border border-border bg-muted/25 p-4"
                      key={capability.key}
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <h3 className="mt-4 font-black">{capability.label}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {capability.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </PublicSection>
          ) : null}

          {sectionIds.has("gallery") ? (
            <PublicSection
              description="Images published by the organization."
              icon={Sparkles}
              id="gallery"
              title="Gallery"
            >
              <OrganizationGallery
                images={organization.gallery}
                organizationType={organization.organizationType}
              />
            </PublicSection>
          ) : null}

          {sectionIds.has("housing") && organization.projections.housing ? (
            <PublicSection
              description="Current homes published and managed by this organization."
              icon={House}
              id="housing"
              title="Housing"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {organization.projections.housing.featuredItems.map((item) => (
                  <Link
                    className="group rounded-3xl border border-border bg-muted/25 p-4 transition hover:border-foreground/20 hover:bg-muted/50"
                    href={item.href}
                    key={item.id}
                  >
                    <p className="font-black group-hover:text-kondo-green">
                      {item.title}
                    </p>
                    {item.context ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.context}
                      </p>
                    ) : null}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-kondo-green">
                      View home <ArrowRight className="h-4 w-4" />
                    </span>
                  </Link>
                ))}
              </div>
              {organization.projections.housing.itemCount >
              organization.projections.housing.featuredItems.length ? (
                <Link
                  className="mt-5 inline-flex items-center gap-2 text-sm font-black text-kondo-green hover:underline"
                  href={`/housing/search?organizationId=${organization.id}`}
                >
                  View all {organization.projections.housing.itemCount} homes
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </PublicSection>
          ) : null}

          {sectionIds.has("products") && organization.projections.products ? (
            <PublicSection
              description="Real products published by this professional organization."
              icon={Package}
              id="products"
              title="Products"
            >
              <OrganizationProjectionCards
                actionLabel="View product"
                projection={organization.projections.products}
              />
            </PublicSection>
          ) : null}

          {sectionIds.has("student-services") &&
          organization.projections["student-services"] ? (
            <PublicSection
              description="Practical services published by this professional organization."
              icon={ConciergeBell}
              id="student-services"
              title="Student services"
            >
              <OrganizationProjectionCards
                actionLabel="View service"
                projection={organization.projections["student-services"]}
              />
            </PublicSection>
          ) : null}

          {sectionIds.has("contact") ? (
            <PublicSection
              description="Only channels explicitly made public are shown."
              icon={Globe2}
              id="contact"
              title="Contact"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {organization.publicContactChannels.map((contact) => (
                  <div
                    className="rounded-3xl border border-border p-4"
                    key={contact.id}
                  >
                    <p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">
                      {contact.label}
                    </p>
                    <p className="mt-2 break-words text-sm font-black">
                      {contact.value}
                    </p>
                    {contact.href ? (
                      <a
                        className="mt-4 inline-flex items-center gap-1 text-sm font-black text-kondo-green hover:underline"
                        href={contact.href}
                        rel={
                          contact.external ? "noopener noreferrer" : undefined
                        }
                        target={contact.external ? "_blank" : undefined}
                      >
                        Open channel <ArrowRight className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </PublicSection>
          ) : null}

          {sectionIds.has("city-context") && organization.relatedCity ? (
            <PublicSection
              description="Continue exploring practical student information on Kondo."
              icon={MapPin}
              id="city-context"
              title={`Explore ${organization.relatedCity.name}`}
            >
              <Link
                className="group flex items-center justify-between rounded-3xl bg-kondo-mint p-5 text-kondo-forest transition hover:-translate-y-0.5 dark:bg-emerald-400/10 dark:text-emerald-200"
                data-product-destination={organization.relatedCity.name}
                data-product-event={
                  PRODUCT_EVENTS.ORGANIZATION_CITY_CONTEXT_OPENED
                }
                data-product-source={organization.organizationType}
                href={organization.relatedCity.href}
              >
                <span>
                  <span className="block font-black">
                    Open the Kondo city guide
                  </span>
                  <span className="mt-1 block text-sm opacity-75">
                    Communities, local guidance and useful places.
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </Link>
            </PublicSection>
          ) : null}
        </TabPanelTransition>

        <aside className="space-y-4 lg:sticky lg:top-36 lg:self-start">
          <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black">
                  {organization.trust.verification.label}
                </p>
                <p className="text-xs font-semibold text-muted-foreground">
                  Trust information
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {organization.trust.verification.explanation}
            </p>
            {organization.trust.partner.active ? (
              <p className="mt-3 rounded-2xl bg-kondo-mint p-3 text-xs font-semibold leading-5 text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                {organization.trust.partner.explanation}
              </p>
            ) : null}
          </div>
          <div className="rounded-[2rem] border border-border bg-card p-5">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
              Profile transparency
            </p>
            {organization.lastPublicUpdate ? (
              <p className="mt-3 text-sm font-semibold">
                Updated {formatDate(organization.lastPublicUpdate)}
              </p>
            ) : null}
            {organization.publicationDate ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Public since {formatDate(organization.publicationDate)}
              </p>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              External links leave Kondo. Review important claims and never
              share payment or identity information without verification.
            </p>
          </div>
        </aside>
      </div>
    </Root>
  );
}

function OrganizationProjectionCards({
  projection,
  actionLabel,
}: {
  projection: OrganizationPublicProfileDTO["projections"][string];
  actionLabel: string;
}) {
  if (!projection) return null;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {projection.featuredItems.map((item) => (
          <Link
            className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-muted/25 transition hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/50 hover:shadow-lift motion-reduce:transform-none"
            href={item.href}
            key={item.id}
          >
            {item.imageUrl ? (
              <span className="block aspect-[16/10] overflow-hidden bg-muted">
                {/* The media endpoint enforces publication visibility itself. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
                  loading="lazy"
                  src={item.imageUrl}
                />
              </span>
            ) : null}
            <span className="flex flex-1 flex-col p-4">
              <span className="line-clamp-2 font-black group-hover:text-kondo-green">
                {item.title}
              </span>
              {item.context ? (
                <span className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {item.context}
                </span>
              ) : null}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-kondo-green">
                {actionLabel} <ArrowRight className="h-4 w-4" />
              </span>
            </span>
          </Link>
        ))}
      </div>
      {projection.sectionRoute &&
      projection.itemCount > projection.featuredItems.length ? (
        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-black text-kondo-green hover:underline"
          href={projection.sectionRoute}
        >
          View all {projection.itemCount}
          <ArrowRight className="h-4 w-4" />
        </Link>
      ) : null}
    </>
  );
}

function PublicSection({
  id,
  icon: Icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: typeof Sparkles;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="scroll-mt-36 rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-7"
      id={id}
    >
      <div className="mb-6 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted text-kondo-green">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-3xl bg-muted/50 p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-kondo-green" />
      <div>
        <p className="text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-sm font-bold leading-6">{value}</p>
      </div>
    </div>
  );
}
