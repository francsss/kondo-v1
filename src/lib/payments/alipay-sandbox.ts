import { sign as signBytes, verify as verifyBytes } from "node:crypto";

type AlipayEnvironment = Record<string, string | undefined>;

export type AlipayConfig = {
  appId: string;
  sellerId: string;
  applicationPrivateKey: string;
  alipayPublicKey: string;
  gatewayUrl: string;
  notifyUrl: string;
  returnUrl: string;
};

type PagePayInput = {
  outTradeNo: string;
  subject: string;
  totalAmountMinor: number;
  timestamp: string;
};

export type AlipayPagePayRequest = {
  gatewayUrl: string;
  params: Record<string, string>;
};

export type VerifiedAlipayNotification = {
  verified: true;
  paid: boolean;
  outTradeNo: string;
  totalAmount: string;
  tradeNo: string;
  tradeStatus: string;
};

type RejectedNotification = {
  verified: false;
  paid: false;
  reason:
    | "MISSING_REQUIRED_FIELD"
    | "UNSUPPORTED_SIGN_TYPE"
    | "INVALID_SIGNATURE"
    | "APP_ID_MISMATCH"
    | "SELLER_ID_MISMATCH"
    | "UNSUPPORTED_TRADE_STATUS";
};

export type AlipayNotificationResult =
  VerifiedAlipayNotification | RejectedNotification;

const REQUIRED_ENVIRONMENT_KEYS = [
  "ALIPAY_APP_ID",
  "ALIPAY_SELLER_ID",
  "ALIPAY_APPLICATION_PRIVATE_KEY",
  "ALIPAY_PUBLIC_KEY",
  "ALIPAY_GATEWAY_URL",
  "ALIPAY_NOTIFY_URL",
  "ALIPAY_RETURN_URL",
] as const;

function normalizePem(value: string) {
  return value.replace(/\\n/g, "\n").trim();
}

function canonicalize(
  params: Record<string, string>,
  excludedKeys: ReadonlySet<string>,
) {
  return Object.entries(params)
    .filter(([key, value]) => !excludedKeys.has(key) && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

export function parseAlipayConfig(
  environment: AlipayEnvironment,
): AlipayConfig | null {
  const values = Object.fromEntries(
    REQUIRED_ENVIRONMENT_KEYS.map((key) => [key, environment[key]?.trim()]),
  ) as Record<(typeof REQUIRED_ENVIRONMENT_KEYS)[number], string | undefined>;

  if (REQUIRED_ENVIRONMENT_KEYS.some((key) => !values[key])) return null;
  try {
    const gateway = new URL(values.ALIPAY_GATEWAY_URL!);
    const sandboxHosts = new Set([
      "openapi-sandbox.dl.alipaydev.com",
      "openapi.alipaydev.com",
    ]);
    if (gateway.protocol !== "https:" || !sandboxHosts.has(gateway.hostname)) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    appId: values.ALIPAY_APP_ID!,
    sellerId: values.ALIPAY_SELLER_ID!,
    applicationPrivateKey: normalizePem(values.ALIPAY_APPLICATION_PRIVATE_KEY!),
    alipayPublicKey: normalizePem(values.ALIPAY_PUBLIC_KEY!),
    gatewayUrl: values.ALIPAY_GATEWAY_URL!,
    notifyUrl: values.ALIPAY_NOTIFY_URL!,
    returnUrl: values.ALIPAY_RETURN_URL!,
  };
}

export function formatAlipayTimestamp(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((values, part) => {
      if (part.type !== "literal") values[part.type] = part.value;
      return values;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function createAlipayPagePayRequest(
  input: PagePayInput,
  config: AlipayConfig,
): AlipayPagePayRequest {
  if (!Number.isSafeInteger(input.totalAmountMinor)) {
    throw new TypeError(
      "Alipay amount must be an integer number of minor units",
    );
  }
  if (input.totalAmountMinor <= 0) {
    throw new RangeError("Alipay amount must be greater than zero");
  }
  if (!input.outTradeNo.trim() || !input.subject.trim()) {
    throw new TypeError("Alipay order number and subject are required");
  }

  const unsignedParams: Record<string, string> = {
    app_id: config.appId,
    biz_content: JSON.stringify({
      out_trade_no: input.outTradeNo,
      product_code: "FAST_INSTANT_TRADE_PAY",
      subject: input.subject,
      total_amount: (input.totalAmountMinor / 100).toFixed(2),
    }),
    charset: "utf-8",
    method: "alipay.trade.page.pay",
    notify_url: config.notifyUrl,
    return_url: config.returnUrl,
    sign_type: "RSA2",
    timestamp: input.timestamp,
    version: "1.0",
  };
  const canonical = canonicalize(unsignedParams, new Set(["sign"]));
  const signature = signBytes(
    "RSA-SHA256",
    Buffer.from(canonical, "utf8"),
    config.applicationPrivateKey,
  ).toString("base64");

  return {
    gatewayUrl: config.gatewayUrl,
    params: { ...unsignedParams, sign: signature },
  };
}

export function verifyAlipayNotification(
  input: Record<string, string>,
  config: AlipayConfig,
): AlipayNotificationResult {
  const required = [
    "app_id",
    "out_trade_no",
    "seller_id",
    "total_amount",
    "trade_no",
    "trade_status",
    "sign",
  ] as const;
  if (required.some((key) => !input[key])) {
    return {
      verified: false,
      paid: false,
      reason: "MISSING_REQUIRED_FIELD",
    };
  }
  if (input.sign_type && input.sign_type !== "RSA2") {
    return {
      verified: false,
      paid: false,
      reason: "UNSUPPORTED_SIGN_TYPE",
    };
  }

  const canonical = canonicalize(input, new Set(["sign", "sign_type"]));
  let signatureIsValid = false;
  try {
    signatureIsValid = verifyBytes(
      "RSA-SHA256",
      Buffer.from(canonical, "utf8"),
      config.alipayPublicKey,
      Buffer.from(input.sign, "base64"),
    );
  } catch {
    signatureIsValid = false;
  }
  if (!signatureIsValid) {
    return { verified: false, paid: false, reason: "INVALID_SIGNATURE" };
  }
  if (input.app_id !== config.appId) {
    return { verified: false, paid: false, reason: "APP_ID_MISMATCH" };
  }
  if (input.seller_id !== config.sellerId) {
    return { verified: false, paid: false, reason: "SELLER_ID_MISMATCH" };
  }
  if (
    ![
      "TRADE_SUCCESS",
      "TRADE_FINISHED",
      "WAIT_BUYER_PAY",
      "TRADE_CLOSED",
    ].includes(input.trade_status)
  ) {
    return {
      verified: false,
      paid: false,
      reason: "UNSUPPORTED_TRADE_STATUS",
    };
  }

  return {
    verified: true,
    paid:
      input.trade_status === "TRADE_SUCCESS" ||
      input.trade_status === "TRADE_FINISHED",
    outTradeNo: input.out_trade_no,
    totalAmount: input.total_amount,
    tradeNo: input.trade_no,
    tradeStatus: input.trade_status,
  };
}

type AlipayOrderSnapshot = {
  reference: string;
  status: string;
  paymentProvider: string;
  paymentReference: string | null;
  totalMinor: number;
  currency: string;
};

export type AlipayOrderTransition =
  | { kind: "MARK_PAID"; tradeNo: string }
  | { kind: "MARK_CANCELLED" }
  | { kind: "ALREADY_PAID" }
  | { kind: "ALREADY_CANCELLED" }
  | { kind: "KEEP_PENDING" }
  | {
      kind: "REJECT";
      reason:
        | "ORDER_MISMATCH"
        | "AMOUNT_MISMATCH"
        | "PAYMENT_REFERENCE_MISMATCH"
        | "ORDER_STATUS_MISMATCH";
    };

function parseAmountMinor(value: string) {
  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(value);
  if (!match) return null;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const amount = major * 100 + minor;
  return Number.isSafeInteger(amount) ? amount : null;
}

export function decideAlipayOrderTransition(
  order: AlipayOrderSnapshot,
  notification: VerifiedAlipayNotification,
): AlipayOrderTransition {
  if (
    order.reference !== notification.outTradeNo ||
    order.paymentProvider !== "ALIPAY" ||
    order.currency !== "CNY"
  ) {
    return { kind: "REJECT", reason: "ORDER_MISMATCH" };
  }
  if (parseAmountMinor(notification.totalAmount) !== order.totalMinor) {
    return { kind: "REJECT", reason: "AMOUNT_MISMATCH" };
  }
  if (
    (order.status === "PAID" || order.status === "CANCELLED") &&
    order.paymentReference !== notification.tradeNo
  ) {
    return { kind: "REJECT", reason: "PAYMENT_REFERENCE_MISMATCH" };
  }
  if (order.status === "PAID") return { kind: "ALREADY_PAID" };
  if (order.status === "CANCELLED") return { kind: "ALREADY_CANCELLED" };
  if (order.status !== "PENDING") {
    return { kind: "REJECT", reason: "ORDER_STATUS_MISMATCH" };
  }
  if (notification.paid) {
    return { kind: "MARK_PAID", tradeNo: notification.tradeNo };
  }
  if (notification.tradeStatus === "TRADE_CLOSED") {
    return { kind: "MARK_CANCELLED" };
  }
  return { kind: "KEEP_PENDING" };
}
