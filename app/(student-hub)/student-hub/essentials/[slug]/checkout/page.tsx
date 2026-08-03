import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudyEssentialCheckout } from "@/components/features/student-hub/StudyEssentialCheckout";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { requireUser } from "@/lib/server-auth";
import {
  getStudyEssential,
  isOrderable,
  STUDY_ESSENTIAL_PAYMENT_METHODS,
} from "@/lib/study-essentials";

export const metadata: Metadata = {
  title: "Checkout — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyEssentialCheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const slug = (await params).slug;
  const essential = await getStudyEssential(slug);
  if (!essential) notFound();
  // A partner item is bought on the partner's platform; there is nothing to
  // check out here.
  if (!isOrderable(essential)) {
    redirect(`/student-hub/essentials/${slug}`);
  }

  return (
    <div className="mx-auto max-w-[960px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
        href={`/student-hub/essentials/${slug}`}
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to {essential.title}
      </Link>

      <h1 className="mt-5 font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
        Checkout
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <div className="rounded-[1.75rem] border border-border bg-card p-4">
          <StudyEssentialCover
            className="aspect-[4/3] w-full rounded-2xl"
            coverEmoji={essential.coverEmoji}
            imageUrl={essential.imageUrl}
            slug={essential.slug}
            title={essential.title}
          />
          <p className="mt-4 font-black leading-snug">{essential.title}</p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            {essential.shortDescription}
          </p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
            {essential.format === "DIGITAL" ? "Digital" : "Physical"} ·{" "}
            {essential.category}
          </p>
        </div>

        <StudyEssentialCheckout
          currency={essential.currency}
          paymentMethods={STUDY_ESSENTIAL_PAYMENT_METHODS}
          slug={essential.slug}
          title={essential.title}
          unitPriceMinor={essential.priceMinor ?? 0}
        />
      </div>
    </div>
  );
}
