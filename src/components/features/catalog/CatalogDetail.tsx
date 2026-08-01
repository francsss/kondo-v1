import Link from "next/link";
import { Building2, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { CatalogPublicActions } from "@/components/features/catalog/CatalogPublicActions";
import type { PublicCatalogItem } from "@/lib/organization-catalog";

export function CatalogDetail({ item }: { item: PublicCatalogItem }) {
  return (
    <main className="min-h-dvh bg-background pb-20 text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6">
          <Link className="font-black" href="/discover">
            ← Discover
          </Link>
          <Link
            className="text-sm font-black text-kondo-green"
            href={`/organizations/${item.organization.slug}`}
          >
            {item.organization.name}
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
          <div>
            <div className="overflow-hidden rounded-4xl bg-muted">
              {item.media[0] ? (
                // The media endpoint enforces its own authorization and scan state.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={item.media[0].altText}
                  className="aspect-[16/10] h-full w-full object-cover"
                  src={item.media[0].url}
                />
              ) : (
                <div className="grid aspect-[16/10] place-items-center bg-gradient-to-br from-kondo-mint to-emerald-50 text-6xl dark:from-emerald-400/10 dark:to-transparent">
                  {item.kind === "product" ? "📦" : "✨"}
                </div>
              )}
            </div>
            {item.media.length > 1 ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {item.media.slice(1).map((media) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={media.altText}
                    className="aspect-[4/3] rounded-2xl object-cover"
                    key={media.id}
                    src={media.url}
                  />
                ))}
              </div>
            ) : null}
            <section className="mt-8 rounded-4xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-xl font-black">About this {item.kind}</h2>
              <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-muted-foreground">
                {item.description}
              </div>
            </section>
          </div>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Organization {item.kind} · {item.category}
            </p>
            <h1 className="mt-3 text-balance text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {item.title}
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {item.shortDescription}
            </p>
            <p className="mt-6 text-2xl font-black">{item.priceLabel}</p>
            <div className="mt-5 space-y-3 rounded-3xl bg-muted/50 p-4 text-sm">
              {item.availabilityLabel ? (
                <p className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-kondo-green" />
                  {item.availabilityLabel}
                </p>
              ) : null}
              {item.deliveryMode ? (
                <p className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-kondo-green" />
                  {item.deliveryMode}
                </p>
              ) : null}
              {item.locationLabel || item.city?.name ? (
                <p className="flex gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-kondo-green" />
                  {item.locationLabel ?? item.city?.name}
                </p>
              ) : null}
            </div>
            <div className="mt-6">
              <CatalogPublicActions
                contactMethod={item.contactMethod}
                externalUrl={item.externalUrl}
                id={item.id}
                kind={item.kind}
                title={item.title}
              />
            </div>
            <Link
              className="mt-6 flex items-center gap-3 rounded-3xl border border-border p-4 transition hover:border-kondo-green/30"
              href={`/organizations/${item.organization.slug}`}
            >
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-2xl bg-kondo-mint">
                {item.organization.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    src={item.organization.logoUrl}
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-kondo-green" />
                )}
              </span>
              <span>
                <span className="flex items-center gap-1.5 font-black">
                  {item.organization.name}
                  {item.organization.verified ? (
                    <ShieldCheck className="h-4 w-4 text-kondo-green" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  View organization
                </span>
              </span>
            </Link>
            <p className="mt-5 text-xs leading-5 text-muted-foreground">
              Kondo facilitates discovery and inquiries. It does not process
              payment, guarantee external claims, or provide checkout for this
              item.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
