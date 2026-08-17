import { NextRequest } from "next/server";
import { logServerEvent } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/payments/registry";
import { settleVerifiedPayment } from "@/lib/payments/settlement";

/**
 * Alipay's asynchronous notification. This is where a payment actually
 * becomes a book.
 *
 * Public by necessity — Alipay's servers call it, not a signed-in browser —
 * which is why the signature is the only thing that grants authority here.
 * Nothing about the request being well-formed, or coming from a plausible
 * address, is treated as evidence.
 *
 * The reply body matters as much as the work: Alipay retries until it reads
 * the literal string `success`. So a verified-but-unsettleable notification
 * returns a non-success body on purpose, to be retried, while a duplicate of
 * something already settled returns `success` to make the retries stop.
 */

export const dynamic = "force-dynamic";

/** Anything other than the acknowledgement string makes Alipay retry. */
const RETRY = new Response("failure", {
  status: 200,
  headers: { "Content-Type": "text/plain" },
});

export async function POST(request: NextRequest) {
  const provider = getPaymentProvider("ALIPAY");

  // Read as text, not as a parsed form: the signature covers these exact
  // decoded values, and re-serialising a parsed body changes them.
  const rawBody = await request.text().catch(() => "");
  if (!rawBody) return RETRY;

  let verdict;
  try {
    verdict = await provider.verifyNotification(rawBody);
  } catch (error) {
    // Missing credentials land here. Retrying is right: the payment is real
    // and the environment is what is broken.
    logServerEvent("payments.notification.error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return RETRY;
  }

  if (!verdict.verified) {
    // Never retried and never acknowledged as success. An unverifiable
    // notification is not evidence of anything.
    logServerEvent("payments.notification.rejected", {
      reason: verdict.reason,
    });
    return new Response("failure", {
      status: 400,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const outcome = await settleVerifiedPayment(verdict);
  if (!outcome.settled) {
    // A 5xx-worthy failure should be retried; a business-level refusal (wrong
    // amount, unknown order) should not, because retrying cannot fix it.
    if (outcome.status >= 500) return RETRY;
    logServerEvent("payments.notification.unsettled", {
      reference: verdict.reference,
      reason: outcome.reason,
    });
    return new Response(provider.notificationAcknowledgement(), {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(provider.notificationAcknowledgement(), {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
