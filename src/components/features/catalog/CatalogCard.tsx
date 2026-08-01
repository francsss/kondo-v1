import Link from "next/link";
import { ArrowRight, Building2, MapPin, Package, Sparkles } from "lucide-react";
import type { PublicCatalogItem } from "@/lib/organization-catalog";

export function CatalogCard({ item }: { item: PublicCatalogItem }) {
  const Icon = item.kind === "product" ? Package : Sparkles;
  return (
    <Link
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-kondo-green/30 hover:shadow-soft"
      href={item.href}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-kondo-mint to-emerald-50 dark:from-emerald-400/10 dark:to-transparent">
        {item.media[0] ? (
          // The authenticated media route is intentionally rendered directly.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={item.media[0].altText}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            src={item.media[0].url}
          />
        ) : (
          <Icon className="absolute inset-0 m-auto h-10 w-10 text-kondo-green/45" />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] backdrop-blur">
          {item.kind}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-black uppercase tracking-[0.1em] text-kondo-green">
          {item.category}
        </p>
        <h3 className="mt-2 line-clamp-2 text-lg font-black leading-snug">
          {item.title}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {item.shortDescription}
        </p>
        <div className="mt-auto pt-5">
          <p className="font-black">{item.priceLabel}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" />
              {item.organization.name}
            </span>
            {item.locationLabel || item.city?.name ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.locationLabel ?? item.city?.name}
              </span>
            ) : null}
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-kondo-green">
            View details{" "}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
