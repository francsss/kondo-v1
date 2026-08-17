import { createSign, createVerify } from "node:crypto";
import {
  PaymentConfigurationError,
  type NotificationVerdict,
  type PaymentHandoff,
  type PaymentIntent,
  type PaymentProvider,
  type PaymentStatus,
} from "@/lib/payments/provider";

/**
 * Alipay mobile website payment (`alipay.trade.wap.pay`), RSA2.
 *
 * Implemented against the Open Platform's documented request format rather
 * than an SDK: the whole integration is two signatures and a sorted string
 * join, and `node:crypto` does both. That is one less dependency in the path
 * of every payment, and the signing rules are visible here instead of behind
 * a wrapper.
 *
 * The two rules that matter, and that are easy to get subtly wrong:
 *
 *   1. The signature is computed over the *raw* parameter values, sorted by
 *      key, joined `k=v&k=v`, with empty values excluded. URL encoding happens
 *      only when the request is finally serialised. Signing the encoded form
 *      produces a signature Alipay rejects.
 *   2. On the way back, the same rule applies to the already-decoded form
 *      fields, minus `sign` and `sign_type`. Re-serialising a parsed body and
 *      signing that is how verification quietly starts failing.
 *
 * The gateway is configuration, not a constant. Alipay has moved its sandbox
 * host more than once, and a hard-coded URL turns that into a code change.
 */

const WAP_PRODUCT_CODE = "QUICK_WAP_WAY";
const SIGN_TYPE = "RSA2";

/** Alipay reports success as either of these. Both mean the money arrived. */
const PAID_STATUSES = new Set(["TRADE_SUCCESS", "TRADE_FINISHED"]);

type AlipayConfig = {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  gateway: string;
  sandbox: boolean;
};

function normaliseKey(value: string, label: "PRIVATE" | "PUBLIC") {
  const trimmed = value.trim().replace(/\\n/g, "\n");
  if (trimmed.includes("-----BEGIN")) return trimmed;
  // Alipay's console hands over bare base64. PEM framing is added here so the
  // environment variable can hold exactly what was copied from the console.
  const header = label === "PRIVATE" ? "PRIVATE KEY" : "PUBLIC KEY";
  const body =
    trimmed
      .replace(/\s+/g, "")
      .match(/.{1,64}/g)
      ?.join("\n") ?? "";
  return `-----BEGIN ${header}-----\n${body}\n-----END ${header}-----`;
}

export function readAlipayConfig(): AlipayConfig | { missing: string[] } {
  const appId = process.env.ALIPAY_APP_ID?.trim() ?? "";
  const privateKey = process.env.ALIPAY_PRIVATE_KEY?.trim() ?? "";
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY?.trim() ?? "";
  const sandbox = (process.env.ALIPAY_ENV ?? "sandbox").trim() !== "production";
  const gateway =
    process.env.ALIPAY_GATEWAY?.trim() ||
    (sandbox
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi.alipay.com/gateway.do");

  const missing: string[] = [];
  if (!appId) missing.push("ALIPAY_APP_ID");
  if (!privateKey) missing.push("ALIPAY_PRIVATE_KEY");
  if (!alipayPublicKey) missing.push("ALIPAY_PUBLIC_KEY");
  if (missing.length) return { missing };

  return {
    appId,
    privateKey: normaliseKey(privateKey, "PRIVATE"),
    alipayPublicKey: normaliseKey(alipayPublicKey, "PUBLIC"),
    gateway,
    sandbox,
  };
}

/**
 * The string Alipay signs: parameters sorted by key, empty values dropped,
 * joined with `&`, values raw.
 */
export function buildSignatureBase(params: Record<string, string>) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .filter((key) => params[key] !== undefined && params[key] !== "")
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

export function signParams(params: Record<string, string>, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(buildSignatureBase(params), "utf8");
  return signer.sign(privateKey, "base64");
}

export function verifySignature(
  params: Record<string, string>,
  signature: string,
  alipayPublicKey: string,
) {
  try {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(buildSignatureBase(params), "utf8");
    return verifier.verify(alipayPublicKey, signature, "base64");
  } catch {
    // A malformed key or signature is a failed verification, never a crash
    // that could be mistaken for something else upstream.
    return false;
  }
}

/** Alipay wants yuan with two decimals, not minor units. */
export function toYuan(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

/** `2026-08-17 09:30:00` in Asia/Shanghai, which is what the gateway expects. */
export function alipayTimestamp(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export class AlipayProvider implements PaymentProvider {
  readonly key = "ALIPAY" as const;

  isConfigured() {
    return !("missing" in readAlipayConfig());
  }

  private config(): AlipayConfig {
    const config = readAlipayConfig();
    if ("missing" in config) {
      throw new PaymentConfigurationError(
        `Alipay is not configured. Missing: ${config.missing.join(", ")}.`,
        config.missing,
      );
    }
    return config;
  }

  async createPayment(intent: PaymentIntent): Promise<PaymentHandoff> {
    const config = this.config();
    if (intent.currency !== "CNY") {
      throw new PaymentConfigurationError(
        `Alipay settles in CNY; this order is in ${intent.currency}.`,
      );
    }

    const params: Record<string, string> = {
      app_id: config.appId,
      method: "alipay.trade.wap.pay",
      format: "JSON",
      charset: "utf-8",
      sign_type: SIGN_TYPE,
      timestamp: alipayTimestamp(),
      version: "1.0",
      notify_url: intent.notifyUrl,
      return_url: intent.returnUrl,
      biz_content: JSON.stringify({
        out_trade_no: intent.reference,
        total_amount: toYuan(intent.amountMinor),
        subject: intent.subject.slice(0, 128),
        product_code: WAP_PRODUCT_CODE,
      }),
    };
    params.sign = signParams(params, config.privateKey);

    // A self-submitting POST rather than a query string: `biz_content` is JSON
    // and easily exceeds what a URL should carry.
    return {
      kind: "form",
      action: config.gateway,
      method: "POST",
      fields: params,
    };
  }

  async verifyNotification(rawBody: string): Promise<NotificationVerdict> {
    const config = this.config();

    // Parsed from the raw body so the values verified are exactly the decoded
    // values Alipay signed.
    const parsed = new URLSearchParams(rawBody);
    const params: Record<string, string> = {};
    for (const [key, value] of parsed.entries()) params[key] = value;

    const signature = params.sign;
    if (!signature) return { verified: false, reason: "Missing signature." };
    if (!verifySignature(params, signature, config.alipayPublicKey)) {
      return { verified: false, reason: "Signature did not verify." };
    }
    // Someone else's valid notification is still not ours.
    if (params.app_id && params.app_id !== config.appId) {
      return { verified: false, reason: "Notification is for another app." };
    }

    const reference = params.out_trade_no;
    if (!reference) {
      return { verified: false, reason: "Missing merchant order reference." };
    }

    const totalAmount = Number(params.total_amount);
    if (!Number.isFinite(totalAmount)) {
      return { verified: false, reason: "Missing or unreadable amount." };
    }

    const tradeStatus = params.trade_status ?? "";
    const status = PAID_STATUSES.has(tradeStatus)
      ? ("PAID" as const)
      : tradeStatus === "TRADE_CLOSED"
        ? ("FAILED" as const)
        : ("PENDING" as const);

    return {
      verified: true,
      reference,
      providerReference: params.trade_no ?? "",
      // Back to minor units, rounded because yuan arrives as a decimal string.
      amountMinor: Math.round(totalAmount * 100),
      currency: "CNY",
      status: params.refund_fee ? "REFUNDED" : status,
      raw: params,
    };
  }

  notificationAcknowledgement() {
    // Alipay retries on anything else, including an empty 200.
    return "success";
  }

  async getPaymentStatus(): Promise<PaymentStatus> {
    // Deliberately not implemented for the pilot. Kondo's own order record is
    // the source of truth, updated by the verified notification; adding a
    // query API now would create a second answer to the same question without
    // being needed by any flow.
    return { status: "UNKNOWN" };
  }
}
