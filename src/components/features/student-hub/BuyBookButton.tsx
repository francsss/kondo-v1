"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

/**
 * Start a payment and hand the browser to Alipay.
 *
 * The button sends a slug and nothing else. It does not know the price, cannot
 * set one, and is not told whether the payment succeeded — that answer only
 * ever comes from the server after Alipay's verified callback.
 *
 * Alipay's WAP payment is a signed POST, so the handoff arrives as a set of
 * fields that are submitted as a real form. Building it here from what the
 * server returned keeps the signing on the server where the private key is.
 */
export function BuyBookButton({
  slug,
  title,
  disabled,
}: {
  slug: string;
  title: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef<string | null>(null);

  async function buy() {
    setPending(true);
    setError("");
    captureProductEvent(PRODUCT_EVENTS.BOOK_PURCHASE_STARTED, { slug });
    try {
      idempotencyKey.current ??= `book:${crypto.randomUUID()}`;
      const response = await fetch("/api/payments/alipay/create", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey.current,
        },
        body: JSON.stringify({ slug }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error ?? "Payment could not be started.");
      }

      if (!body.handoff && body.reference) {
        router.push(`/student-hub/books/payment?reference=${body.reference}`);
        return;
      }
      const handoff = body.handoff;
      if (handoff?.kind === "redirect") {
        window.location.href = handoff.url;
        return;
      }
      if (handoff?.kind === "form") {
        const form = document.createElement("form");
        form.method = handoff.method;
        form.action = handoff.action;
        form.style.display = "none";
        for (const [name, value] of Object.entries(
          handoff.fields as Record<string, string>,
        )) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.append(input);
        }
        document.body.append(form);
        form.submit();
        return;
      }
      throw new Error("Payment could not be started.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Payment could not be started.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <Button
        disabled={pending || disabled}
        fullWidth
        onClick={() => void buy()}
        type="button"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        ) : null}
        {pending ? "Opening Alipay…" : `Buy ${title} with Alipay`}
      </Button>
      {disabled ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Purchases are closed on this environment.
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs font-bold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
