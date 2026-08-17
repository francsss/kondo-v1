import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  parseAlipayConfig: vi.fn(),
  placeAlipayOrder: vi.fn(),
  placeSimulatedOrder: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/payments/alipay-sandbox", () => ({
  parseAlipayConfig: mocks.parseAlipayConfig,
}));

vi.mock("@/lib/study-essentials", () => ({
  StudyEssentialError: class StudyEssentialError extends Error {
    status = 400;
  },
  placeAlipayOrder: mocks.placeAlipayOrder,
  placeSimulatedOrder: mocks.placeSimulatedOrder,
}));

import { POST } from "../../app/api/student-hub/essentials/orders/route";

function request(
  paymentProvider: "SIMULATED" | "ALIPAY",
  idempotencyKey?: string,
  quantity = 1,
) {
  return new NextRequest(
    "http://localhost:3000/api/student-hub/essentials/orders",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify({
        slug: "hsk-test-book",
        quantity,
        paymentProvider,
      }),
    },
  );
}

describe("Study Essential order API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "student-1" });
    mocks.parseAlipayConfig.mockReturnValue(null);
    mocks.placeSimulatedOrder.mockResolvedValue({
      reference: "KS-DEMO",
      status: "PAID",
    });
    mocks.placeAlipayOrder.mockResolvedValue({
      order: { reference: "KS-ALIPAY", status: "PENDING" },
      payment: {
        gatewayUrl: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
        params: { app_id: "sandbox-app-id", sign: "signed-request" },
      },
    });
  });

  it("requires an idempotency key for Alipay orders", async () => {
    mocks.parseAlipayConfig.mockReturnValue({ appId: "sandbox-app-id" });

    const response = await POST(request("ALIPAY"));

    expect(response.status).toBe(400);
    expect(mocks.placeAlipayOrder).not.toHaveBeenCalled();
  });

  it("rejects a malformed Alipay idempotency key", async () => {
    mocks.parseAlipayConfig.mockReturnValue({ appId: "sandbox-app-id" });

    const response = await POST(request("ALIPAY", "short"));

    expect(response.status).toBe(400);
    expect(mocks.placeAlipayOrder).not.toHaveBeenCalled();
  });

  it("keeps Alipay disabled when sandbox configuration is absent", async () => {
    const response = await POST(request("ALIPAY", "checkout-12345678"));

    expect(response.status).toBe(503);
    expect(mocks.placeAlipayOrder).not.toHaveBeenCalled();
  });

  it("creates a pending Alipay order and returns a signed form request", async () => {
    const config = { appId: "sandbox-app-id" };
    mocks.parseAlipayConfig.mockReturnValue(config);

    const response = await POST(request("ALIPAY", "checkout-12345678"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.placeAlipayOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "student-1",
        slug: "hsk-test-book",
        quantity: 1,
        idempotencyKey: "checkout-12345678",
        config,
      }),
    );
    expect(body).toEqual({
      ok: true,
      order: { reference: "KS-ALIPAY", status: "PENDING" },
      payment: {
        gatewayUrl: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
        params: { app_id: "sandbox-app-id", sign: "signed-request" },
      },
    });
  });

  it("lets the domain resolve an existing key before quantity limits", async () => {
    const config = { appId: "sandbox-app-id" };
    mocks.parseAlipayConfig.mockReturnValue(config);

    const response = await POST(request("ALIPAY", "checkout-12345678", 11));

    expect(mocks.placeAlipayOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 11,
        idempotencyKey: "checkout-12345678",
      }),
    );
    expect(response.status).toBe(200);
  });

  it("preserves the immediate simulated-payment path", async () => {
    const response = await POST(request("SIMULATED"));

    expect(response.status).toBe(200);
    expect(mocks.placeSimulatedOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentProvider: "SIMULATED" }),
    );
    expect(mocks.placeAlipayOrder).not.toHaveBeenCalled();
  });
});
