import { generateKeyPairSync, sign as signBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  alipayTimestamp,
  buildSignatureBase,
  signParams,
  toYuan,
  verifySignature,
} from "@/lib/payments/alipay";

/**
 * The signing rules, tested against a real RSA key pair rather than a mock.
 *
 * Signature code fails silently and expensively: a wrong base string produces
 * a signature the gateway rejects with a generic error, and a too-permissive
 * verifier accepts forgeries. Both are cheap to pin here and painful to
 * discover in a sandbox.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

describe("alipay signature base", () => {
  it("sorts keys and joins them without encoding the values", () => {
    const base = buildSignatureBase({
      charset: "utf-8",
      app_id: "2021000000000000",
      // A value that would change shape if it were URL-encoded first.
      biz_content: '{"out_trade_no":"KB1","total_amount":"9.90"}',
    });
    expect(base).toBe(
      'app_id=2021000000000000&biz_content={"out_trade_no":"KB1","total_amount":"9.90"}&charset=utf-8',
    );
  });

  it("includes sign_type in an outbound request signature", () => {
    const base = buildSignatureBase({
      app_id: "a",
      sign: "should-not-appear",
      sign_type: "RSA2",
    });
    expect(base).toBe("app_id=a&sign_type=RSA2");
  });

  it("excludes sign_type only when verifying a notification", () => {
    expect(
      buildSignatureBase(
        { app_id: "a", sign: "should-not-appear", sign_type: "RSA2" },
        true,
      ),
    ).toBe("app_id=a");
  });

  it("drops empty values rather than signing empty pairs", () => {
    expect(buildSignatureBase({ a: "1", b: "", c: "3" })).toBe("a=1&c=3");
  });
});

describe("alipay signature verification", () => {
  const params = {
    app_id: "2021000000000000",
    out_trade_no: "KB123",
    total_amount: "9.90",
    trade_status: "TRADE_SUCCESS",
    sign_type: "RSA2",
  };

  it("accepts a notification signature that excludes sign_type", () => {
    const signature = signBytes(
      "RSA-SHA256",
      Buffer.from(buildSignatureBase(params, true), "utf8"),
      privateKey,
    ).toString("base64");
    expect(verifySignature(params, signature, publicKey)).toBe(true);
  });

  it("rejects a signature when any signed value is altered", () => {
    const signature = signParams(params, privateKey);
    // The attack this exists to stop: a replayed notification with the amount
    // edited down.
    expect(
      verifySignature(
        { ...params, total_amount: "0.01" },
        signature,
        publicKey,
      ),
    ).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const other = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    const forged = signParams(params, other.privateKey);
    expect(verifySignature(params, forged, publicKey)).toBe(false);
  });

  it("returns false rather than throwing on a malformed key or signature", () => {
    expect(verifySignature(params, "not-base64-!!", publicKey)).toBe(false);
    expect(verifySignature(params, "abc", "-----BEGIN PUBLIC KEY-----x")).toBe(
      false,
    );
  });
});

describe("alipay value formats", () => {
  it("converts minor units to yuan with two decimals", () => {
    expect(toYuan(990)).toBe("9.90");
    expect(toYuan(1)).toBe("0.01");
    expect(toYuan(100000)).toBe("1000.00");
  });

  it("formats the timestamp the way the gateway expects", () => {
    const stamp = alipayTimestamp(new Date("2026-08-17T01:30:00Z"));
    // Asia/Shanghai is UTC+8, so 01:30Z is 09:30 the same day.
    expect(stamp).toBe("2026-08-17 09:30:00");
    expect(stamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
