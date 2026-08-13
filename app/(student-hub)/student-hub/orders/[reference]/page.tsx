import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, Receipt, Truck } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { requireUser } from "@/lib/server-auth";
import { getStudyEssentialOrder } from "@/lib/study-essentials";

export const metadata: Metadata = {
  title: "Order confirmed — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyEssentialOrderPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await requireUser();
  const order = await getStudyEssentialOrder(user.id, (await params).reference);
  if (!order) notFound();

  const money = (minor: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: order.currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);
  const digital = order.formatSnapshot === "DIGITAL";

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-[2rem] border border-border bg-card p-6 text-center shadow-soft sm:p-10">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <Check aria-hidden="true" className="h-8 w-8" />
        </span>
        <h1 className="mt-6 text-balance font-display text-3xl font-black tracking-[-0.04em]">
          Order confirmed
        </h1>
        <p className="mx-auto mt-3 max-w-md text-pretty text-sm leading-6 text-muted-foreground">
          Your demo order is recorded. No money was taken — Study Essentials
          runs a simulated payment while it is in preview.
        </p>

        <div className="mt-7 flex items-center gap-4 rounded-[1.5rem] border border-border bg-background p-4 text-left">
          <StudyEssentialCover
            className="h-16 w-16 shrink-0 rounded-2xl"
            coverEmoji={order.essential.coverEmoji}
            emojiClassName="text-2xl"
            imageUrl={order.essential.imageUrl}
            slug={order.essential.slug}
            title={order.titleSnapshot}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-black">{order.titleSnapshot}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {money(order.unitPriceMinor)} × {order.quantity}
            </p>
          </div>
          <p className="shrink-0 text-lg font-black tabular-nums">
            {money(order.totalMinor)}
          </p>
        </div>

        <dl className="mt-5 grid gap-2.5 text-left text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-black tabular-nums">{order.reference}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-black">
              {order.status === "PAID" ? "Paid (simulated)" : order.status}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Payment method</dt>
            <dd className="font-black">Kondo demo payment</dd>
          </div>
        </dl>

        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-muted/60 px-4 py-3 text-left text-xs leading-5 text-muted-foreground">
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
            ? "Delivery of digital items will be enabled with the first real payment provider."
            : "Shipping details will be collected once real payments are enabled."}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            href="/student-hub/orders"
          >
            <Receipt aria-hidden="true" className="h-4 w-4" />
            Your orders
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-black transition hover:border-kondo-green hover:text-kondo-green"
            href="/student-hub/essentials"
          >
            Back to Study Essentials
          </Link>
        </div>
      </div>
    </div>
  );
}
