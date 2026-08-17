import {
  generateKeyPairSync,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAlipayPagePayRequest,
  decideAlipayOrderTransition,
  formatAlipayTimestamp,
  parseAlipayConfig,
  verifyAlipayNotification,
} from "@/lib/payments/alipay-sandbox";
import {
  getAlipayOrderPresentation,
  nextPendingOrderPollDelay,
  startPendingOrderPolling,
} from "@/lib/payments/alipay-order-presentation";

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

const completeEnvironment = {
  ALIPAY_APP_ID: "sandbox-app-id",
  ALIPAY_SELLER_ID: "sandbox-seller-id",
  ALIPAY_APPLICATION_PRIVATE_KEY: applicationKeys.privateKey,
  ALIPAY_PUBLIC_KEY: alipayKeys.publicKey,
  ALIPAY_GATEWAY_URL: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
  ALIPAY_NOTIFY_URL: "https://example.test/api/payments/alipay/notify",
  ALIPAY_RETURN_URL: "https://example.test/books/payment/success",
};

function canonicalize(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([key, value]) => key !== "sign" && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function signedNotification(
  config: NonNullable<ReturnType<typeof parseAlipayConfig>>,
  overrides: Partial<Record<string, string>> = {},
) {
  const unsigned = {
    app_id: config.appId,
    charset: "utf-8",
    out_trade_no: "book-order-123",
    seller_id: config.sellerId,
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

  return { ...unsigned, sign, sign_type: "RSA2" };
}

describe("Alipay sandbox configuration", () => {
  it("stays disabled when any required server-only setting is missing", () => {
    expect(parseAlipayConfig({})).toBeNull();
    expect(
      parseAlipayConfig({
        ...completeEnvironment,
        ALIPAY_APPLICATION_PRIVATE_KEY: undefined,
      }),
    ).toBeNull();
  });

  it("accepts a complete sandbox configuration without reading global state", () => {
    expect(parseAlipayConfig(completeEnvironment)).toMatchObject({
      appId: "sandbox-app-id",
      sellerId: "sandbox-seller-id",
      gatewayUrl: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
      notifyUrl: "https://example.test/api/payments/alipay/notify",
      returnUrl: "https://example.test/books/payment/success",
    });
  });

  it("does not silently enable a production gateway", () => {
    expect(
      parseAlipayConfig({
        ...completeEnvironment,
        ALIPAY_GATEWAY_URL: "https://openapi.alipay.com/gateway.do",
      }),
    ).toBeNull();
  });
});

describe("Alipay sandbox page-pay request", () => {
  it("formats integer minor units exactly and produces an RSA2 signature", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    const request = createAlipayPagePayRequest(
      {
        outTradeNo: "book-order-123",
        subject: "HSK test EPUB",
        totalAmountMinor: 1,
        timestamp: "2026-08-17 12:00:00",
      },
      config,
    );
    const bizContent = JSON.parse(request.params.biz_content) as Record<
      string,
      string
    >;

    expect(request.gatewayUrl).toBe(completeEnvironment.ALIPAY_GATEWAY_URL);
    expect(request.params).toMatchObject({
      app_id: "sandbox-app-id",
      method: "alipay.trade.page.pay",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: "2026-08-17 12:00:00",
      version: "1.0",
      notify_url: completeEnvironment.ALIPAY_NOTIFY_URL,
      return_url: completeEnvironment.ALIPAY_RETURN_URL,
    });
    expect(bizContent).toEqual({
      out_trade_no: "book-order-123",
      product_code: "FAST_INSTANT_TRADE_PAY",
      subject: "HSK test EPUB",
      total_amount: "0.01",
    });
    expect(
      verifyBytes(
        "RSA-SHA256",
        Buffer.from(canonicalize(request.params), "utf8"),
        applicationKeys.publicKey,
        Buffer.from(request.params.sign, "base64"),
      ),
    ).toBe(true);
  });

  it("rejects fractional or negative minor-unit amounts", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(() =>
      createAlipayPagePayRequest(
        {
          outTradeNo: "book-order-fractional",
          subject: "HSK test EPUB",
          totalAmountMinor: 1.5,
          timestamp: "2026-08-17 12:00:00",
        },
        config,
      ),
    ).toThrow();
    expect(() =>
      createAlipayPagePayRequest(
        {
          outTradeNo: "book-order-negative",
          subject: "HSK test EPUB",
          totalAmountMinor: -1,
          timestamp: "2026-08-17 12:00:00",
        },
        config,
      ),
    ).toThrow();
  });
});

describe("Alipay sandbox notification verification", () => {
  it("verifies with the Alipay public key and returns claims for caller reconciliation", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(
      verifyAlipayNotification(signedNotification(config), config),
    ).toEqual({
      verified: true,
      paid: true,
      outTradeNo: "book-order-123",
      totalAmount: "9.90",
      tradeNo: "sandbox-trade-456",
      tradeStatus: "TRADE_SUCCESS",
    });
  });

  it("rejects a notification with a bad signature", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");
    const notification = signedNotification(config);
    const signature = Buffer.from(notification.sign, "base64");
    signature[0] = (signature[0] ?? 0) ^ 1;

    expect(
      verifyAlipayNotification(
        { ...notification, sign: signature.toString("base64") },
        config,
      ),
    ).toEqual({
      verified: false,
      paid: false,
      reason: "INVALID_SIGNATURE",
    });
  });

  it("rejects a correctly signed notification for a different app", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(
      verifyAlipayNotification(
        signedNotification(config, { app_id: "another-app-id" }),
        config,
      ),
    ).toEqual({
      verified: false,
      paid: false,
      reason: "APP_ID_MISMATCH",
    });
  });

  it("rejects a correctly signed notification for a different seller", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(
      verifyAlipayNotification(
        signedNotification(config, { seller_id: "another-seller-id" }),
        config,
      ),
    ).toEqual({
      verified: false,
      paid: false,
      reason: "SELLER_ID_MISMATCH",
    });
  });

  it.each([
    ["TRADE_SUCCESS", true],
    ["TRADE_FINISHED", true],
    ["WAIT_BUYER_PAY", false],
    ["TRADE_CLOSED", false],
  ])("maps %s to paid=%s only after signature verification", (status, paid) => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(
      verifyAlipayNotification(
        signedNotification(config, { trade_status: status }),
        config,
      ),
    ).toMatchObject({
      verified: true,
      paid,
      tradeStatus: status,
    });
  });

  it("rejects an unknown trade status instead of acknowledging it", () => {
    const config = parseAlipayConfig(completeEnvironment);
    expect(config).not.toBeNull();
    if (!config) throw new Error("Expected complete test configuration");

    expect(
      verifyAlipayNotification(
        signedNotification(config, { trade_status: "UNKNOWN_STATUS" }),
        config,
      ),
    ).toEqual({
      verified: false,
      paid: false,
      reason: "UNSUPPORTED_TRADE_STATUS",
    });
  });
});

describe("Alipay order presentation", () => {
  it.each([
    [
      "PENDING",
      {
        title: "Waiting for payment confirmation",
        statusLabel: "Pending (Alipay sandbox)",
        shouldPoll: true,
      },
    ],
    [
      "PAID",
      {
        title: "Order confirmed",
        statusLabel: "Paid (Alipay sandbox)",
        shouldPoll: false,
      },
    ],
    [
      "CANCELLED",
      {
        title: "Payment cancelled",
        statusLabel: "Cancelled",
        shouldPoll: false,
      },
    ],
    [
      "FAILED",
      {
        title: "Payment failed",
        statusLabel: "Failed",
        shouldPoll: false,
      },
    ],
  ])("presents %s as an explicit order state", (status, expected) => {
    expect(getAlipayOrderPresentation(status)).toMatchObject(expected);
  });

  it("uses bounded backoff and stops polling after five minutes", () => {
    expect(nextPendingOrderPollDelay(0, 0)).toBe(2_500);
    expect(nextPendingOrderPollDelay(1, 2_500)).toBe(5_000);
    expect(nextPendingOrderPollDelay(2, 7_500)).toBe(10_000);
    expect(nextPendingOrderPollDelay(10, 4 * 60_000)).toBe(30_000);
    expect(nextPendingOrderPollDelay(10, 5 * 60_000)).toBeNull();
  });

  it("refreshes with backoff, pauses while hidden, and can be stopped", () => {
    vi.useFakeTimers();
    const refresh = vi.fn();
    let visible = true;
    let now = 0;
    const onTimeout = vi.fn();
    const stop = startPendingOrderPolling({
      refresh,
      isVisible: () => visible,
      onTimeout,
      now: () => now,
      schedule: (callback, delay) =>
        setTimeout(() => {
          now += delay;
          callback();
        }, delay),
      cancel: (timeout) => clearTimeout(timeout),
    });

    vi.advanceTimersByTime(2_500);
    expect(refresh).toHaveBeenCalledTimes(1);
    visible = false;
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    visible = true;
    vi.advanceTimersByTime(5 * 60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    const refreshCountAtTimeout = refresh.mock.calls.length;
    vi.advanceTimersByTime(60_000);
    expect(refresh).toHaveBeenCalledTimes(refreshCountAtTimeout);

    stop();
    vi.useRealTimers();
  });
});

describe("Alipay order reconciliation", () => {
  const notification = {
    verified: true as const,
    paid: true,
    outTradeNo: "KS-1234",
    totalAmount: "9.90",
    tradeNo: "sandbox-trade-456",
    tradeStatus: "TRADE_SUCCESS",
  };

  it("settles only the matching pending Alipay CNY order", () => {
    expect(
      decideAlipayOrderTransition(
        {
          reference: "KS-1234",
          status: "PENDING",
          paymentProvider: "ALIPAY",
          paymentReference: null,
          totalMinor: 990,
          currency: "CNY",
        },
        notification,
      ),
    ).toEqual({ kind: "MARK_PAID", tradeNo: "sandbox-trade-456" });
  });

  it("accepts an identical paid notification without granting twice", () => {
    expect(
      decideAlipayOrderTransition(
        {
          reference: "KS-1234",
          status: "PAID",
          paymentProvider: "ALIPAY",
          paymentReference: "sandbox-trade-456",
          totalMinor: 990,
          currency: "CNY",
        },
        notification,
      ),
    ).toEqual({ kind: "ALREADY_PAID" });
  });

  it.each([
    ["wrong reference", { reference: "KS-OTHER" }, "ORDER_MISMATCH"],
    ["wrong provider", { paymentProvider: "SIMULATED" }, "ORDER_MISMATCH"],
    ["wrong currency", { currency: "USD" }, "ORDER_MISMATCH"],
    ["wrong amount", { totalMinor: 991 }, "AMOUNT_MISMATCH"],
    [
      "different payment reference",
      { status: "PAID", paymentReference: "another-trade" },
      "PAYMENT_REFERENCE_MISMATCH",
    ],
  ])("rejects %s", (_label, override, reason) => {
    expect(
      decideAlipayOrderTransition(
        {
          reference: "KS-1234",
          status: "PENDING",
          paymentProvider: "ALIPAY",
          paymentReference: null,
          totalMinor: 990,
          currency: "CNY",
          ...override,
        },
        notification,
      ),
    ).toEqual({ kind: "REJECT", reason });
  });

  it("leaves a valid unpaid status pending", () => {
    expect(
      decideAlipayOrderTransition(
        {
          reference: "KS-1234",
          status: "PENDING",
          paymentProvider: "ALIPAY",
          paymentReference: null,
          totalMinor: 990,
          currency: "CNY",
        },
        { ...notification, paid: false, tradeStatus: "WAIT_BUYER_PAY" },
      ),
    ).toEqual({ kind: "KEEP_PENDING" });
  });

  it("cancels idempotently after a verified TRADE_CLOSED notification", () => {
    const pending = {
      reference: "KS-1234",
      status: "PENDING",
      paymentProvider: "ALIPAY",
      paymentReference: null,
      totalMinor: 990,
      currency: "CNY",
    };
    const closed = {
      ...notification,
      paid: false,
      tradeStatus: "TRADE_CLOSED",
    };
    expect(decideAlipayOrderTransition(pending, closed)).toEqual({
      kind: "MARK_CANCELLED",
    });
    expect(
      decideAlipayOrderTransition(
        {
          ...pending,
          status: "CANCELLED",
          paymentReference: notification.tradeNo,
        },
        closed,
      ),
    ).toEqual({ kind: "ALREADY_CANCELLED" });
  });

  it("formats timestamps in the provider's Asia/Shanghai timezone", () => {
    expect(formatAlipayTimestamp(new Date("2026-08-17T04:00:00.000Z"))).toBe(
      "2026-08-17 12:00:00",
    );
  });
});
