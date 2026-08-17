import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the notification handler is allowed to do, and what it must refuse.
 *
 * These are the rules that stand between a payment callback and a free book:
 * the amount comes from the order rather than the callback, a replay grants
 * nothing extra, and no path marks an order paid without granting access in
 * the same transaction.
 */

const mocks = vi.hoisted(() => ({
  findOrder: vi.fn(),
  updateManyOrders: vi.fn(),
  upsertEntitlement: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logServerError: vi.fn(),
  logServerEvent: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const client = {
    studyEssentialOrder: {
      findUnique: mocks.findOrder,
      updateMany: mocks.updateManyOrders,
    },
    studyEntitlement: { upsert: mocks.upsertEntitlement },
  };
  return {
    prisma: {
      ...client,
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(client),
      ),
    },
  };
});

import { settleVerifiedPayment } from "@/lib/payments/settlement";

function verdict(overrides: Record<string, unknown> = {}) {
  return {
    verified: true as const,
    reference: "KB123",
    providerReference: "2026081722001",
    amountMinor: 990,
    currency: "CNY",
    status: "PAID" as const,
    raw: { trade_no: "2026081722001", trade_status: "TRADE_SUCCESS" },
    ...overrides,
  };
}

const pendingOrder = {
  id: "order-1",
  userId: "user-1",
  essentialId: "book-1",
  status: "PENDING",
  paymentProvider: "ALIPAY",
  totalMinor: 990,
  currency: "CNY",
  paymentReference: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOrder.mockResolvedValue(pendingOrder);
  mocks.updateManyOrders.mockResolvedValue({ count: 1 });
  mocks.upsertEntitlement.mockResolvedValue({});
});

describe("settling a verified payment", () => {
  it("marks the order paid and grants access in the same transaction", async () => {
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: true, alreadySettled: false });
    expect(mocks.updateManyOrders.mock.calls[0][0].data.status).toBe("PAID");
    expect(mocks.upsertEntitlement).toHaveBeenCalledTimes(1);
  });

  it("refuses to settle an order created for another provider", async () => {
    mocks.findOrder.mockResolvedValue({
      ...pendingOrder,
      paymentProvider: "SIMULATED",
    });
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 409 });
    expect(mocks.updateManyOrders).not.toHaveBeenCalled();
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("refuses when the notified amount does not match the order", async () => {
    // The attack: a real signed notification for a cheaper item, replayed
    // against an expensive order.
    const result = await settleVerifiedPayment(verdict({ amountMinor: 1 }));
    expect(result).toMatchObject({ settled: false });
    expect(mocks.updateManyOrders).not.toHaveBeenCalled();
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("refuses when the currency does not match the order", async () => {
    const result = await settleVerifiedPayment(verdict({ currency: "USD" }));
    expect(result).toMatchObject({ settled: false });
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("grants nothing for pending or refunded trade status", async () => {
    for (const status of ["PENDING", "REFUNDED"] as const) {
      vi.clearAllMocks();
      const result = await settleVerifiedPayment(verdict({ status }));
      expect(result, status).toMatchObject({ settled: false });
      expect(mocks.upsertEntitlement, status).not.toHaveBeenCalled();
    }
  });

  it("cancels a pending order after a verified closed trade", async () => {
    const result = await settleVerifiedPayment(verdict({ status: "FAILED" }));
    expect(result).toMatchObject({ settled: true, alreadySettled: false });
    expect(mocks.updateManyOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("treats a duplicate closed trade as already settled", async () => {
    mocks.findOrder.mockResolvedValue({
      ...pendingOrder,
      status: "CANCELLED",
      paymentReference: "2026081722001",
    });
    const result = await settleVerifiedPayment(verdict({ status: "FAILED" }));
    expect(result).toMatchObject({ settled: true, alreadySettled: true });
    expect(mocks.updateManyOrders).not.toHaveBeenCalled();
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("rejects a paid notification after the order was cancelled", async () => {
    mocks.findOrder.mockResolvedValue({
      ...pendingOrder,
      status: "CANCELLED",
      paymentReference: "2026081722001",
    });
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 409 });
    expect(mocks.updateManyOrders).not.toHaveBeenCalled();
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("does not grant access when a closed trade wins a concurrent race", async () => {
    mocks.updateManyOrders.mockResolvedValue({ count: 0 });
    mocks.findOrder.mockResolvedValueOnce(pendingOrder).mockResolvedValueOnce({
      status: "CANCELLED",
      paymentReference: "2026081722001",
    });
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 409 });
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("reports a missing order instead of inventing one", async () => {
    mocks.findOrder.mockResolvedValue(null);
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 404 });
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("treats a matching duplicate notification as already settled", async () => {
    mocks.findOrder.mockResolvedValue({
      ...pendingOrder,
      status: "PAID",
      paymentReference: "2026081722001",
    });
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: true, alreadySettled: true });
    // The order is not re-marked...
    expect(mocks.updateManyOrders).not.toHaveBeenCalled();
    // ...but the entitlement is re-asserted, and it is an upsert on a unique
    // pair, so it cannot produce a second grant.
    expect(mocks.upsertEntitlement).toHaveBeenCalledTimes(1);
    const call = mocks.upsertEntitlement.mock.calls[0][0];
    expect(call.where.userId_essentialId).toEqual({
      userId: "user-1",
      essentialId: "book-1",
    });
  });

  it("rejects a duplicate notification with different reconciliation data", async () => {
    mocks.findOrder.mockResolvedValue({
      ...pendingOrder,
      status: "PAID",
      paymentReference: "different-trade",
    });
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 409 });
    expect(mocks.upsertEntitlement).not.toHaveBeenCalled();
  });

  it("never writes credentials or a signature into the stored payload", async () => {
    await settleVerifiedPayment(
      verdict({
        raw: {
          trade_no: "x",
          trade_status: "TRADE_SUCCESS",
          sign: "SECRET-SIGNATURE",
          sign_type: "RSA2",
        },
      }),
    );
    const payload = JSON.stringify(
      mocks.updateManyOrders.mock.calls[0][0].data.providerPayload,
    );
    expect(payload).not.toContain("SECRET-SIGNATURE");
    expect(payload).not.toContain("sign_type");
  });

  it("asks to be retried when the database fails, rather than acknowledging", async () => {
    mocks.findOrder.mockRejectedValue(new Error("connection lost"));
    const result = await settleVerifiedPayment(verdict());
    expect(result).toMatchObject({ settled: false, status: 500 });
  });
});
