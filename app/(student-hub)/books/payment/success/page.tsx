import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Payment return — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AlipayReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ out_trade_no?: string }>;
}) {
  await requireUser();
  const reference = (await searchParams).out_trade_no?.trim();
  if (reference)
    redirect(`/student-hub/orders/${encodeURIComponent(reference)}`);

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center sm:px-6">
      <h1 className="font-display text-3xl font-black">Payment returned</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Kondo could not identify the order from the browser return. Payment
        access is still decided only by the signed server notification.
      </p>
      <Link
        className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground"
        href="/student-hub/orders"
      >
        View your orders
      </Link>
    </div>
  );
}
