"use client";

import { useRouter } from "next/navigation";
import { Loader2, Lock, Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type PaymentMethod = {
  key: string;
  label: string;
  hint: string;
  available: boolean;
};

/** Checkout keeps provider credentials and payment confirmation server-side. */
export function StudyEssentialCheckout({
  slug,
  title,
  unitPriceMinor,
  currency,
  paymentMethods,
}: {
  slug: string;
  title: string;
  unitPriceMinor: number;
  currency: string;
  paymentMethods: readonly PaymentMethod[];
}) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState(
    paymentMethods.find((method) => method.available)?.key ?? "SIMULATED",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const idempotency = useRef<{
    fingerprint: string;
    key: string;
  } | null>(null);

  const total = unitPriceMinor * quantity;
  const money = (minor: number) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(minor / 100);

  async function pay() {
    setLoading(true);
    setError("");
    try {
      const fingerprint = `${slug}:${quantity}:${provider}`;
      if (idempotency.current?.fingerprint !== fingerprint) {
        idempotency.current = {
          fingerprint,
          key: `checkout:${crypto.randomUUID()}`,
        };
      }
      const response = await fetch("/api/student-hub/essentials/orders", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(provider === "ALIPAY"
            ? { "Idempotency-Key": idempotency.current.key }
            : {}),
        },
        body: JSON.stringify({ slug, quantity, paymentProvider: provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "The demo payment could not be completed.");
        return;
      }
      if (data.payment?.gatewayUrl && data.payment?.params) {
        const form = document.createElement("form");
        form.action = data.payment.gatewayUrl;
        form.method = "POST";
        for (const [key, value] of Object.entries(data.payment.params)) {
          if (typeof value !== "string") continue;
          const field = document.createElement("input");
          field.type = "hidden";
          field.name = key;
          field.value = value;
          form.appendChild(field);
        }
        document.body.appendChild(form);
        form.submit();
        return;
      }
      router.push(`/student-hub/orders/${data.order.reference}`);
      router.refresh();
    } catch {
      setError("Kondo could not reach the checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-[1.75rem] border border-border bg-card p-5">
        <h2 className="text-sm font-black tracking-tight">Quantity</h2>
        <div className="mt-3 flex items-center gap-3">
          <button
            aria-label="Decrease quantity"
            className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:border-kondo-green hover:text-kondo-green disabled:opacity-40"
            disabled={quantity <= 1 || loading}
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            type="button"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span
            aria-live="polite"
            className="min-w-10 text-center text-lg font-black tabular-nums"
          >
            {quantity}
          </span>
          <button
            aria-label="Increase quantity"
            className="grid h-11 w-11 place-items-center rounded-full border border-border transition hover:border-kondo-green hover:text-kondo-green disabled:opacity-40"
            disabled={quantity >= 10 || loading}
            onClick={() => setQuantity((value) => Math.min(10, value + 1))}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border bg-card p-5">
        <h2 className="text-sm font-black tracking-tight">Payment method</h2>
        <div className="mt-3 grid gap-2.5">
          {paymentMethods.map((method) => {
            const selected = provider === method.key;
            return (
              <button
                aria-pressed={selected}
                className={cn(
                  "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition",
                  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kondo-green/20",
                  !method.available && "cursor-not-allowed opacity-55",
                  selected
                    ? "border-kondo-green bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
                    : "border-border bg-background hover:border-kondo-green/50",
                )}
                disabled={!method.available || loading}
                key={method.key}
                onClick={() => setProvider(method.key)}
                type="button"
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                    selected
                      ? "border-kondo-green bg-kondo-green"
                      : "border-border",
                  )}
                >
                  {selected ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black">
                    {method.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {method.hint}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-border bg-card p-5">
        <dl className="grid gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="min-w-0 truncate text-muted-foreground">{title}</dt>
            <dd className="shrink-0 font-bold tabular-nums">
              {money(unitPriceMinor)} × {quantity}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2.5">
            <dt className="font-black">Total</dt>
            <dd className="text-xl font-black tabular-nums">{money(total)}</dd>
          </div>
        </dl>

        {error ? (
          <p
            className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <Button
          className="mt-5"
          disabled={loading}
          fullWidth
          onClick={pay}
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              {provider === "ALIPAY"
                ? "Opening Alipay sandbox…"
                : "Completing demo payment…"}
            </>
          ) : (
            <>
              <Lock aria-hidden="true" className="h-4 w-4" />
              Pay {money(total)}
            </>
          )}
        </Button>
        <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">
          {provider === "ALIPAY"
            ? "Sandbox only. Kondo waits for Alipay's signed server notification before unlocking the book."
            : "This is a simulated payment. No money is taken and no card details are collected."}
        </p>
      </section>
    </div>
  );
}
