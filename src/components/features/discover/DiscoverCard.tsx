import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  GraduationCap,
  House,
  MapPin,
  Package,
  ShoppingBag,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import type { DiscoverItem } from "@/features/discover/types";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

const icons = {
  organizations: Building2,
  housing: House,
  opportunities: GraduationCap,
  products: Package,
  services: Sparkles,
  marketplace: ShoppingBag,
  skills: Wrench,
  communities: Users,
  universities: GraduationCap,
  cities: MapPin,
  events: CalendarDays,
} as const;

export function DiscoverCard({ item }: { item: DiscoverItem }) {
  const Icon = icons[item.type];
  return (
    <Link
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-card transition duration-200 hover:-translate-y-0.5 hover:border-kondo-green/30 hover:shadow-soft motion-reduce:transform-none"
      data-discover-resource={item.type}
      data-product-destination={item.type}
      data-product-event={PRODUCT_EVENTS.DISCOVER_RESULT_OPENED}
      data-product-source={item.analytics.sourceDomain}
      href={item.href}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-kondo-mint via-emerald-50 to-white dark:from-emerald-400/10 dark:via-transparent dark:to-transparent">
        {item.imageUrl ? (
          // Provider-owned media can come from multiple guarded Kondo routes.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
            src={item.imageUrl}
          />
        ) : (
          <Icon
            aria-hidden
            className="absolute inset-0 m-auto h-9 w-9 text-kondo-green/50"
          />
        )}
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] backdrop-blur">
          {item.eyebrow}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 text-lg font-black leading-snug">
          {item.title}
        </h3>
        {item.description ? (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
            {item.description}
          </p>
        ) : null}
        <div className="mt-auto pt-5">
          {item.recommendationReason ? (
            <p className="mb-3 inline-flex rounded-full bg-kondo-mint px-2.5 py-1 text-[10px] font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
              Why this: {item.recommendationReason}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {item.location}
              </span>
            ) : null}
            {item.metadata.slice(0, 2).map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-kondo-green">
            Open{" "}
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
