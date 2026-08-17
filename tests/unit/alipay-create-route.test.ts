import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  findOrder: vi.fn(),
  findEssential: vi.fn(),
  createOrder: vi.fn(),
  checkEntitlement: vi.fn(),
  assertPaymentsUsable: vi.fn(),
  createPayment: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/study-entitlements", () => ({
  checkEntitlement: mocks.checkEntitlement,
}));
vi.mock("@/lib/logger", () => ({ logServerEvent: vi.fn() }));
vi.mock("@/lib/payments/registry", () => ({
  assertPaymentsUsable: mocks.assertPaymentsUsable,
  getPaymentProvider: () => ({
    key: "ALIPAY",
    createPayment: mocks.createPayment,
  }),
  isBooksPilotMode: () => true,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    studyEssentialOrder: {
      findUnique: mocks.findOrder,
      create: mocks.createOrder,
    },
    studyEssential: { findFirst: mocks.findEssential },
  },
}));

import { POST } from "../../app/api/payments/alipay/create/route";

function request(slug = "book-one", idempotencyKey?: string) {
  return new NextRequest("http://localhost:3000/api/payments/alipay/create", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ slug }),
  });
}

const pendingOrder = {
  reference: "KB-1",
  status: "PENDING",
  totalMinor: 990,
  currency: "CNY",
  placedAt: new Date("2026-08-17T01:30:00Z"),
  essential: { slug: "book-one", title: "Book One" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
  mocks.rateLimit.mockResolvedValue({ allowed: true });
  mocks.findOrder.mockResolvedValue(null);
  mocks.findEssential.mockResolvedValue({
    id: "essential-1",
    slug: "book-one",
    title: "Book One",
    format: "DIGITAL",
    source: "KONDO",
    priceMinor: 990,
    currency: "CNY",
  });
  mocks.checkEntitlement.mockResolvedValue({ allowed: false });
  mocks.createOrder.mockResolvedValue(pendingOrder);
  mocks.createPayment.mockResolvedValue({
    kind: "form",
    action: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    method: "POST",
    fields: { sign: "same-signature" },
  });
});

describe("Alipay create route idempotency", () => {
  it("requires a valid idempotency key", async () => {
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it("reuses a pending order and its stable creation timestamp", async () => {
    mocks.findOrder.mockResolvedValue(pendingOrder);
    const response = await POST(request("book-one", "book:12345678"));

    expect(response.status).toBe(200);
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: "KB-1",
        createdAt: pendingOrder.placedAt,
      }),
    );
  });

  it("returns 409 when the same key is reused for another title", async () => {
    mocks.findOrder.mockResolvedValue(pendingOrder);
    const response = await POST(request("book-two", "book:12345678"));

    expect(response.status).toBe(409);
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });

  it("does not reopen checkout for a terminal order", async () => {
    mocks.findOrder.mockResolvedValue({ ...pendingOrder, status: "PAID" });
    const response = await POST(request("book-one", "book:12345678"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reference: "KB-1",
      status: "PAID",
      handoff: null,
    });
    expect(mocks.assertPaymentsUsable).not.toHaveBeenCalled();
    expect(mocks.createPayment).not.toHaveBeenCalled();
  });

  it("recovers the winning order after a concurrent unique conflict", async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError(
      "unique conflict",
      { code: "P2002", clientVersion: "5.22.0" },
    );
    mocks.createOrder.mockRejectedValue(uniqueConflict);
    mocks.findOrder
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingOrder);

    const response = await POST(request("book-one", "book:12345678"));

    expect(response.status).toBe(200);
    expect(mocks.findOrder).toHaveBeenCalledTimes(2);
    expect(mocks.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "KB-1" }),
    );
  });
});
