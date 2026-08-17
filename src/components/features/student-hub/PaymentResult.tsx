"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

/**
 * Where the browser lands after Alipay.
 *
 * This page grants nothing and believes nothing the gateway told the browser.
 * It asks Kondo what state the order is in, and Kondo only knows that because
 * a signed notification was verified on the server. Returning here with a
 * hand-edited URL therefore achieves exactly nothing.
 *
 * The callback often lands before the browser does, and occasionally after, so
 * a PENDING answer is polled for a short while rather than treated as failure.
 */

type Order = {
  reference: string;
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";
  titleSnapshot: string;
  slug: string;
};

/** Around a minute of polling, then the reader is offered a manual refresh. */
const MAX_ATTEMPTS = 20;
const INTERVAL_MS = 3000;

export function PaymentResult({ reference }: { reference: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function poll(attempt: number) {
      try {
        const response = await fetch(`/api/study/orders/${reference}`, {
          credentials: "include",
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "Order not found.");
        if (cancelled) return;

        setOrder(body);
        setAttempts(attempt);
        if (body.status === "PAID") {
          captureProductEvent(PRODUCT_EVENTS.BOOK_PAYMENT_CONFIRMED, {
            slug: body.slug,
          });
          return;
        }
        // Only PENDING is worth waiting on. A failed or cancelled order will
        // not change on its own.
        if (body.status === "PENDING" && attempt < MAX_ATTEMPTS) {
          timer = window.setTimeout(() => void poll(attempt + 1), INTERVAL_MS);
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Order not found.");
        }
      }
    }

    captureProductEvent(PRODUCT_EVENTS.BOOK_PAYMENT_RETURNED, {});
    void poll(0);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [reference]);

  if (error) {
    return (
      <Shell
        icon={<XCircle className="h-6 w-6 text-destructive" />}
        title="We could not find that order"
      >
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button asChild className="mt-5" variant="secondary">
          <Link href="/student-hub/books">Back to Books</Link>
        </Button>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell
        icon={
          <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
        }
        title="Checking your payment"
      >
        <p className="text-sm text-muted-foreground">One moment.</p>
      </Shell>
    );
  }

  if (order.status === "PAID") {
    return (
      <Shell
        icon={<CheckCircle2 className="h-6 w-6 text-kondo-green" />}
        title="Payment confirmed"
      >
        <p className="text-sm text-muted-foreground">
          {order.titleSnapshot} is in My Books.
        </p>
        <Button asChild className="mt-5" fullWidth>
          <Link href={`/student-hub/books/${order.slug}`}>Start reading</Link>
        </Button>
      </Shell>
    );
  }

  if (order.status === "PENDING") {
    const waiting = attempts < MAX_ATTEMPTS;
    return (
      <Shell
        icon={
          waiting ? (
            <Loader2 className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <Clock className="h-6 w-6 text-muted-foreground" />
          )
        }
        title="Confirming payment…"
      >
        <p className="text-sm text-muted-foreground">
          {waiting
            ? "Alipay is telling us about your payment. This usually takes a few seconds."
            : "This is taking longer than usual. Your payment is safe — refresh in a moment, and the book appears in My Books as soon as it is confirmed."}
        </p>
        {!waiting ? (
          <Button
            className="mt-5"
            onClick={() => window.location.reload()}
            variant="secondary"
          >
            Check again
          </Button>
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell
      icon={<XCircle className="h-6 w-6 text-destructive" />}
      title={
        order.status === "CANCELLED" ? "Payment cancelled" : "Payment failed"
      }
    >
      <p className="text-sm text-muted-foreground">
        Nothing was charged. You can try again from Books.
      </p>
      <Button asChild className="mt-5" variant="secondary">
        <Link href="/student-hub/books">Back to Books</Link>
      </Button>
    </Shell>
  );
}

function Shell({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-16">
      <Card className="p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">
          {icon}
        </div>
        <h1 className="mt-4 text-xl font-black">{title}</h1>
        <div className="mt-2">{children}</div>
      </Card>
    </div>
  );
}
