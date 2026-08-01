import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileText, ShieldCheck, WalletCards } from "lucide-react";
import { paymentCapability } from "@/lib/payments/orchestration";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Payment readiness" };

export default async function PaymentReadinessPage() {
  const user = await requireUser();
  await captureServerProductEvent({
    distinctId: user.id,
    event: PRODUCT_EVENTS.PAYMENT_UNAVAILABLE_VIEWED,
    properties: { provider_configured: paymentCapability.enabled },
  });
  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Link
        className="text-sm font-black text-kondo-green"
        href="/discover/essentials"
      >
        ← Kondo Essentials
      </Link>
      <section className="mt-6 rounded-4xl border border-border bg-card p-7 shadow-soft sm:p-10">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
          <WalletCards className="h-6 w-6" />
        </span>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Provider-ready foundation
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">
          Payments are not active yet.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
          {paymentCapability.reason}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <PaymentFact icon={ShieldCheck} title="No custody">
            Kondo will not hold funds, exchange currency or claim to be a bank.
          </PaymentFact>
          <PaymentFact icon={Building2} title="Authorized partners">
            A configured provider must handle KYC, compliance, FX, settlement
            and refunds.
          </PaymentFact>
          <PaymentFact icon={FileText} title="Real references only">
            Invoices, quotes, rates, currencies and payment status must come
            from an official source.
          </PaymentFact>
        </div>
        <div className="mt-8 rounded-3xl bg-muted/60 p-5">
          <h2 className="font-black">What is available now</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Architecture for official payment links or QR codes, manual invoice
            references, authorized payment-provider adapters and future private
            university billing adapters. There is no functional Pay now action
            and no simulated completion.
          </p>
        </div>
      </section>
    </div>
  );
}

function PaymentFact({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border p-4">
      <Icon className="h-5 w-5 text-kondo-green" />
      <h2 className="mt-3 font-black">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </div>
  );
}
