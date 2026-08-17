import { prisma } from "@/lib/prisma";
import { logServerError, logServerEvent } from "@/lib/logger";
import { grantEntitlement } from "@/lib/study-entitlements";
import type { NotificationVerdict } from "@/lib/payments/provider";

/**
 * Turning a verified payment into an entitlement, exactly once.
 *
 * This is the only place an order becomes PAID. Everything it does is checked
 * against Kondo's own record rather than the notification: the amount comes
 * from the order, not the callback, and the callback's amount has to match it.
 * A provider notification is evidence that money moved, not an instruction
 * about how much.
 *
 * Idempotency is enforced twice over, because payment callbacks are retried by
 * design and arrive out of order:
 *
 *   - an order already PAID is acknowledged and left alone, so a replay is a
 *     no-op rather than a second grant;
 *   - the entitlement is upserted on (userId, essentialId), which is unique, so
 *     even a genuine race between two callbacks writes one row.
 *
 * Both happen inside one transaction, so an order can never be marked paid
 * without its entitlement, or the reverse.
 */

export type SettlementOutcome =
  | { settled: true; alreadySettled: boolean; orderId: string }
  | { settled: false; reason: string; status: number };

export async function settleVerifiedPayment(
  verdict: Extract<NotificationVerdict, { verified: true }>,
): Promise<SettlementOutcome> {
  if (verdict.status !== "PAID") {
    // Pending and failed notifications are legitimate traffic; they simply do
    // not grant anything. Acknowledged so the provider stops retrying.
    return {
      settled: false,
      reason: `Trade status is ${verdict.status}.`,
      status: 200,
    };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.studyEssentialOrder.findUnique({
        where: { reference: verdict.reference },
        select: {
          id: true,
          userId: true,
          essentialId: true,
          status: true,
          totalMinor: true,
          currency: true,
          paymentReference: true,
        },
      });
      if (!order) {
        return {
          settled: false,
          reason: "No local order for that reference.",
          status: 404,
        } as const;
      }

      if (order.status === "PAID") {
        // The common case on a retry. The entitlement is re-asserted rather
        // than assumed, so an order that was paid before entitlements existed
        // still ends up with one.
        await grantEntitlement(tx, {
          userId: order.userId,
          essentialId: order.essentialId,
          source: "PURCHASE",
          orderId: order.id,
        });
        return {
          settled: true,
          alreadySettled: true,
          orderId: order.id,
        } as const;
      }

      // The amount is the order's, and the notification has to agree with it.
      // Trusting the callback here is how an order for one book gets settled
      // by a payment for a cheaper one.
      if (verdict.amountMinor !== order.totalMinor) {
        return {
          settled: false,
          reason: `Amount mismatch: notified ${verdict.amountMinor}, order ${order.totalMinor}.`,
          status: 409,
        } as const;
      }
      if (verdict.currency !== order.currency) {
        return {
          settled: false,
          reason: `Currency mismatch: notified ${verdict.currency}, order ${order.currency}.`,
          status: 409,
        } as const;
      }

      await tx.studyEssentialOrder.update({
        where: { id: order.id },
        data: {
          status: "PAID",
          paidAt: new Date(),
          paymentReference: verdict.providerReference || order.paymentReference,
          // Enough of the notification to reconcile a dispute. No credentials:
          // the signature and the raw key material are dropped here.
          providerPayload: {
            trade_no: verdict.raw.trade_no ?? null,
            trade_status: verdict.raw.trade_status ?? null,
            total_amount: verdict.raw.total_amount ?? null,
            gmt_payment: verdict.raw.gmt_payment ?? null,
            buyer_logon_id: verdict.raw.buyer_logon_id ?? null,
          },
        },
      });

      await grantEntitlement(tx, {
        userId: order.userId,
        essentialId: order.essentialId,
        source: "PURCHASE",
        orderId: order.id,
      });

      return {
        settled: true,
        alreadySettled: false,
        orderId: order.id,
      } as const;
    });
  } catch (error) {
    logServerError("payments.settlement", error);
    // A 500 makes the provider retry, which is what we want: the payment is
    // real and unsettled, and the next attempt should find the database well.
    return { settled: false, reason: "Settlement failed.", status: 500 };
  } finally {
    logServerEvent("payments.notification", {
      reference: verdict.reference,
      status: verdict.status,
    });
  }
}
