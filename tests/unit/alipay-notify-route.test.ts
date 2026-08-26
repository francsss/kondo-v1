import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settleVerifiedPayment: vi.fn(),
}));

vi.mock("@/lib/payments/settlement", () => ({
  settleVerifiedPayment: mocks.settleVerifiedPayment,
}));

import { POST } from "../../app/api/payments/alipay/notify/route";

const applicationKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const alipayKeys = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

function canonicalize(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([key, value]) => !["sign", "sign_type"].includes(key) && value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function notification(overrides: Partial<Record<string, string>> = {}) {
  const unsigned = {
    app_id: "sandbox-app-id",
    charset: "utf-8",
    out_trade_no: "KS-1234",
    seller_id: "sandbox-seller-id",
    total_amount: "9.90",
    trade_no: "sandbox-trade-456",
    trade_status: "TRADE_SUCCESS",
    ...overrides,
  };
  const sign = signBytes(
    "RSA-SHA256",
    Buffer.from(canonicalize(unsigned), "utf8"),
    alipayKeys.privateKey,
  ).toString("base64");
  const body = new URLSearchParams({ ...unsigned, sign, sign_type: "RSA2" });

  return new NextRequest("http://localhost:3000/api/payments/alipay/notify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("Alipay notification route", () => {
  beforeEach(() => {
    vi.stubEnv("ALIPAY_APP_ID", "sandbox-app-id");
    vi.stubEnv("ALIPAY_SELLER_ID", "sandbox-seller-id");
    vi.stubEnv("ALIPAY_APPLICATION_PRIVATE_KEY", applicationKeys.privateKey);
    vi.stubEnv("ALIPAY_PUBLIC_KEY", alipayKeys.publicKey);
    vi.stubEnv(
      "ALIPAY_GATEWAY_URL",
      "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
    );
    vi.stubEnv(
      "ALIPAY_NOTIFY_URL",
      "https://example.test/api/payments/alipay/notify",
    );
    vi.stubEnv(
      "ALIPAY_RETURN_URL",
      "https://example.test/books/payment/success",
    );
    mocks.settleVerifiedPayment.mockResolvedValue({
      settled: true,
      alreadySettled: false,
      orderId: "order-1",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("acknowledges a verified and reconciled payment", async () => {
    const response = await POST(notification());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");
    expect(mocks.settleVerifiedPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        verified: true,
        status: "PAID",
        reference: "KS-1234",
        amountMinor: 990,
        providerReference: "sandbox-trade-456",
      }),
    );
  });

  it("rejects any content type except URL-encoded form data", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/payments/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ trade_status: "TRADE_SUCCESS" }),
      }),
    );

    expect(response.status).toBe(415);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("rejects an oversized notification before parsing or settlement", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/payments/alipay/notify", {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(64 * 1024 + 1),
        },
        body: "padding=small-body",
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("rejects a chunked notification that exceeds the actual body limit", async () => {
    const response = await POST(
      new NextRequest("http://localhost:3000/api/payments/alipay/notify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `padding=${"x".repeat(64 * 1024)}`,
      }),
    );

    expect(response.status).toBe(413);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("requires notifications to declare RSA2", async () => {
    const signed = notification();
    const withoutSignType = (await signed.text()).replace(
      /&sign_type=RSA2$/,
      "",
    );
    const response = await POST(
      new NextRequest(signed.url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: withoutSignType,
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("rejects a signed notification for another seller", async () => {
    const response = await POST(notification({ seller_id: "other-seller" }));

    expect(response.status).toBe(400);
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("rejects a signed amount with more than two decimal places", async () => {
    const response = await POST(notification({ total_amount: "9.901" }));

    expect(response.status).toBe(400);
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("rejects an unknown trade status", async () => {
    const response = await POST(
      notification({ trade_status: "TRADE_UNKNOWN" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("returns failure without touching an order for a bad signature", async () => {
    const signed = notification();
    const tamperedBody = (await signed.text()).replace(
      "total_amount=9.90",
      "total_amount=0.01",
    );
    const response = await POST(
      new NextRequest(signed.url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tamperedBody,
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("does not acknowledge a verified notification that fails reconciliation", async () => {
    mocks.settleVerifiedPayment.mockResolvedValue({
      settled: false,
      reason: "AMOUNT_MISMATCH",
      status: 409,
    });

    const response = await POST(notification());

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");
  });

  it("rejects production payment configuration", async () => {
    vi.stubEnv("ALIPAY_ENV", "production");
    vi.stubEnv("PAYMENTS_ALLOW_PRODUCTION", "true");
    vi.stubEnv("ALIPAY_GATEWAY", "https://openapi.alipay.com/gateway.do");
    vi.stubEnv("ALIPAY_GATEWAY_URL", "https://openapi.alipay.com/gateway.do");

    const response = await POST(notification());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });

  it("stays disabled when server credentials are incomplete", async () => {
    vi.stubEnv("ALIPAY_PUBLIC_KEY", "");

    const response = await POST(notification());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("failure");
    expect(mocks.settleVerifiedPayment).not.toHaveBeenCalled();
  });
});
