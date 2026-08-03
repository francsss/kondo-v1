import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Receipt } from "lucide-react";
import { StudyEssentialCover } from "@/components/features/student-hub/StudyEssentialCover";
import { requireUser } from "@/lib/server-auth";
import { listStudyEssentialOrders } from "@/lib/study-essentials";

export const metadata: Metadata = {
  title: "Your orders — Study Essentials",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StudyEssentialOrdersPage() {
  const user = await requireUser();
  const orders = await listStudyEssentialOrders(user.id);

  return (
    <div className="mx-auto max-w-[960px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <Link
        className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
        href="/student-hub/essentials"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Study Essentials
      </Link>

      <h1 className="mt-5 font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">
        Your orders
      </h1>
      <p className="mt-2.5 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
        Every Study Essentials order you have placed. Payments are simulated
        while the catalogue is in preview, so nothing here has been charged.
      </p>

      {orders.length ? (
        <ul className="mt-7 grid gap-3">
          {orders.map((order) => {
            const money = new Intl.NumberFormat("en", {
              style: "currency",
              currency: order.currency,
              maximumFractionDigits: order.totalMinor % 100 === 0 ? 0 : 2,
            }).format(order.totalMinor / 100);
            return (
              <li key={order.id}>
                <Link
                  className="flex items-center gap-4 rounded-[1.5rem] border border-border bg-card p-4 transition hover:border-kondo-green/50 hover:shadow-sm"
                  href={`/student-hub/orders/${order.reference}`}
                >
                  <StudyEssentialCover
                    className="h-14 w-14 shrink-0 rounded-2xl"
                    coverEmoji={order.essential.coverEmoji}
                    emojiClassName="text-xl"
                    imageUrl={order.essential.imageUrl}
                    slug={order.essential.slug}
                    title={order.titleSnapshot}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black">
                      {order.titleSnapshot}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {order.reference} ·{" "}
                      {new Intl.DateTimeFormat("en", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(order.placedAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-black tabular-nums">
                      {money}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-kondo-green">
                      {order.status === "PAID" ? "Paid (demo)" : order.status}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-8 rounded-[2rem] border border-dashed border-border p-10 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
            <Receipt aria-hidden="true" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-black">No orders yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Anything you order from Study Essentials will appear here with its
            reference and status.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center rounded-full bg-primary px-6 text-sm font-black text-primary-foreground transition hover:bg-primary/90"
            href="/student-hub/essentials"
          >
            Browse Study Essentials
          </Link>
        </div>
      )}
    </div>
  );
}
