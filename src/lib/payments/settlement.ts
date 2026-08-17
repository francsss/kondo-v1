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
  if (verdict.status === "PENDING" || verdict.status === "REFUNDED") {
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
          paymentProvider: true,
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

      if (order.paymentProvider !== "ALIPAY") {
        return {
          settled: false,
          reason: `Order belongs to ${order.paymentProvider}, not Alipay.`,
          status: 409,
        } as const;
      }

      // The amount is the order's, and every notification — including a
      // duplicate for an already-paid order — has to agree with it.
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
      if (
        order.paymentReference &&
        verdict.providerReference !== order.paymentReference
      ) {
        return {
          settled: false,
          reason: "Provider trade reference does not match this order.",
          status: 409,
        } as const;
      }

      const targetStatus = verdict.status === "FAILED" ? "CANCELLED" : "PAID";
      if (order.status === targetStatus) {
        if (targetStatus === "PAID") {
          await grantEntitlement(tx, {
            userId: order.userId,
            essentialId: order.essentialId,
            source: "PURCHASE",
            orderId: order.id,
          });
        }
        return {
          settled: true,
          alreadySettled: true,
          orderId: order.id,
        } as const;
      }
      if (order.status !== "PENDING") {
        return {
          settled: false,
          reason: `Cannot mark an order in ${order.status} as ${targetStatus}.`,
          status: 409,
        } as const;
      }

      const changed = await tx.studyEssentialOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: {
          status: targetStatus,
          paymentReference: verdict.providerReference || order.paymentReference,
          ...(targetStatus === "PAID" ? { paidAt: new Date() } : {}),
          providerPayload: {
            trade_no: verdict.raw.trade_no ?? null,
            trade_status: verdict.raw.trade_status ?? null,
            total_amount: verdict.raw.total_amount ?? null,
            ...(targetStatus === "PAID"
              ? {
                  gmt_payment: verdict.raw.gmt_payment ?? null,
                  buyer_logon_id: verdict.raw.buyer_logon_id ?? null,
                }
              : {}),
          },
        },
      });

      if (changed.count !== 1) {
        const current = await tx.studyEssentialOrder.findUnique({
          where: { id: order.id },
          select: { status: true, paymentReference: true },
        });
        if (
          current?.status !== targetStatus ||
          (current.paymentReference &&
            current.paymentReference !== verdict.providerReference)
        ) {
          return {
            settled: false,
            reason: "A conflicting payment status won the settlement race.",
            status: 409,
          } as const;
        }
        if (targetStatus === "PAID") {
          await grantEntitlement(tx, {
            userId: order.userId,
            essentialId: order.essentialId,
            source: "PURCHASE",
            orderId: order.id,
          });
        }
        return {
          settled: true,
          alreadySettled: true,
          orderId: order.id,
        } as const;
      }

      if (targetStatus === "PAID") {
        await grantEntitlement(tx, {
          userId: order.userId,
          essentialId: order.essentialId,
          source: "PURCHASE",
          orderId: order.id,
        });
      }

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
