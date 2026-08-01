import Link from "next/link";
import { ArrowRight, Info, MapPin } from "lucide-react";
import { ClampedTitle, ExpandableText } from "@/components/ui/ClampedText";
import type { LocalRecommendation } from "@/lib/local-recommendations";

/**
 * A compact Home rail for Food & Services and Student Skills near the member.
 *
 * Deliberately small: a few cards and a link into the real section. Each card
 * states its source type, its publisher, and the reason it appeared, so the
 * member can always check a recommendation against what they told Kondo.
 */
export function LocalRecommendationsRail({
  items,
}: {
  items: LocalRecommendation[];
}) {
  // Only shown when there is real published content to show.
  if (!items.length) return null;

  return (
    <section aria-labelledby="near-you-heading" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            className="font-display text-2xl font-black tracking-tight"
            id="near-you-heading"
          >
            Near you
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Food, services and student skills available where you are.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-black text-kondo-green hover:underline"
          href="/marketplace?view=food-services"
        >
          Food &amp; Services{" "}
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <article className="flex h-full flex-col rounded-3xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="w-fit rounded-full bg-kondo-green/10 px-2.5 py-1 text-xs font-bold text-kondo-green">
                {item.sourceLabel}
              </span>

              <h3 className="mt-3 text-base font-black leading-snug">
                <Link className="hover:underline" href={item.href}>
                  <ClampedTitle>{item.title}</ClampedTitle>
                </Link>
              </h3>

              <p className="mt-1 text-sm font-semibold">{item.publisher}</p>

              {item.description ? (
                <ExpandableText
                  className="mt-1.5 text-sm leading-6 text-muted-foreground"
                  lines={3}
                  text={item.description}
                />
              ) : null}

              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {item.location ? (
                  <p className="flex items-center gap-1.5">
                    <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                    {item.location}
                  </p>
                ) : null}
                {/* Price and availability appear only when genuinely published. */}
                {item.priceLabel ? <p>{item.priceLabel}</p> : null}
                {item.availabilityLabel ? (
                  <p>{item.availabilityLabel}</p>
                ) : null}
              </div>

              {/* The member can always see why this appeared. */}
              <p
                className="mt-4 flex items-start gap-1.5 rounded-2xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"
                data-testid="recommendation-reason"
              >
                <Info
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
                {item.reason}
              </p>

              <div className="mt-auto pt-4">
                <Link
                  className="inline-flex min-h-11 items-center rounded-full bg-secondary px-5 text-sm font-black text-secondary-foreground transition hover:bg-secondary/75"
                  href={item.href}
                >
                  View
                </Link>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
