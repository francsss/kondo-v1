import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Download,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { requireUser } from "@/lib/server-auth";
import { ownsEssential } from "@/lib/study-workspace";
import {
  formatEssentialPrice,
  getStudyEssential,
  isOrderable,
} from "@/lib/study-essentials";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const essential = await getStudyEssential((await params).slug);
  if (!essential) return { title: "Study essential not found" };
  return {
    title: `${essential.title} — Study Essentials`,
    description: essential.shortDescription,
  };
}

export default async function StudyEssentialDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const essential = await getStudyEssential((await params).slug);
  if (!essential) notFound();

  const price = formatEssentialPrice(essential.priceMinor, essential.currency);
  const orderable = isOrderable(essential);
  const digital = essential.format === "DIGITAL";
  // Ownership comes from the one place that defines it: a PAID order.
  const owned = await ownsEssential(user.id, essential.id);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/essentials"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Study Essentials
      </Link>

      <div className="mt-5 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="min-w-0">
          <StudyEssentialCover
            className="aspect-[16/9] w-full rounded-[2rem]"
            coverEmoji={essential.coverEmoji}
            emojiClassName="text-7xl"
            imageUrl={essential.imageUrl}
            slug={essential.slug}
            title={essential.title}
          />

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              {digital ? "Digital" : "Physical"}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              {essential.category}
            </span>
            {essential.source === "PARTNER" ? (
              <span className="rounded-full bg-kondo-lime/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-kondo-forest dark:bg-lime-400/15 dark:text-lime-200">
                Partner
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 text-balance font-display text-3xl font-black leading-[1.1] tracking-[-0.04em] sm:text-4xl">
            {essential.title}
          </h1>
          <p className="mt-3 text-pretty text-base leading-7 text-muted-foreground">
            {essential.shortDescription}
          </p>

          {essential.highlights.length ? (
            <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {essential.highlights.map((highlight) => (
                <li
                  className="flex items-start gap-2.5 rounded-2xl bg-muted/50 p-3.5 text-sm font-semibold leading-6"
                  key={highlight}
                >
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green"
                  />
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-7 whitespace-pre-wrap text-base leading-8 text-muted-foreground">
            {essential.description}
          </div>
        </div>

        <aside className="lg:sticky lg:top-20">
          <div className="rounded-[2rem] border border-border bg-card p-5 shadow-sm sm:p-6">
            {price ? (
              <p className="text-3xl font-black tabular-nums tracking-tight">
                {price}
              </p>
            ) : (
              <p className="text-sm font-bold leading-6">
                Pricing is shown on {essential.providerName}.
              </p>
            )}

            {essential.providerName ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Provided by{" "}
                <span className="font-bold text-foreground">
                  {essential.providerName}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Published by Kondo
              </p>
            )}

            {owned ? (
              /* Already paid for. Offering to sell it again is the fastest way
                 to look like the store is not paying attention. */
              <Link
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90 motion-reduce:transform-none"
                href={
                  digital
                    ? `/student-hub/essentials/read/${essential.slug}`
                    : "/student-hub/essentials/library"
                }
              >
                {digital ? "Open book" : "In your library"}
              </Link>
            ) : orderable ? (
              <Link
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90 motion-reduce:transform-none"
                href={`/student-hub/essentials/${essential.slug}/checkout`}
              >
                Buy this
              </Link>
            ) : essential.externalUrl ? (
              <a
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:-translate-y-0.5 hover:bg-primary/90 motion-reduce:transform-none"
                href={essential.externalUrl}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                Open on {essential.providerName}
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </a>
            ) : null}

            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              {digital ? (
                <Download
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green"
                />
              ) : (
                <Truck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green"
                />
              )}
              {digital
                ? "Digital item — available from your orders once the purchase completes."
                : "Physical item — delivery details are collected after the order is placed."}
            </p>

            {essential.source === "PARTNER" ? (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-background px-3.5 py-3 text-xs leading-5 text-muted-foreground">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-kondo-green"
                />
                This link leaves Kondo. The partner handles enrolment, payment
                and support, under their own terms.
              </p>
            ) : (
              <p className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                Payments are simulated while Study Essentials is in preview. No
                money is taken and no card details are collected.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
