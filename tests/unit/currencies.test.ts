import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_CURRENCY_CODES,
} from "@/lib/currencies";

const byCode = new Map(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]),
);

describe("supported currencies", () => {
  it("covers the world, not one region", () => {
    // A currency picker is one of the quieter places a product says who it was
    // built for. This one used to hold 42 African currencies and a handful of
    // majors, which left a student from Pakistan or Kazakhstan with no way to
    // name the money in their pocket.
    expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(150);
    for (const code of [
      "PKR",
      "IDR",
      "KZT",
      "RUB",
      "THB",
      "VND",
      "INR",
      "BDT",
      "UZS",
      "MNT",
      "BRL",
      "MXN",
      "PLN",
      "TRY",
    ]) {
      expect(SUPPORTED_CURRENCY_CODES.has(code)).toBe(true);
    }
  });

  it("keeps the currencies the launch market already used", () => {
    // Regenerating the list must never drop what was there, and must never
    // lose the hand-picked symbols, which read better than ICU's fallbacks.
    for (const [code, symbol] of [
      ["XAF", "FCFA"],
      ["XOF", "CFA"],
      ["GHS", "GH₵"],
      ["NGN", "₦"],
      ["KES", "KSh"],
      ["ZAR", "R"],
      ["RWF", "FRw"],
      ["ETB", "Br"],
    ]) {
      expect(byCode.get(code!)?.symbol).toBe(symbol);
    }
  });

  it("leads with what a student in China actually spends", () => {
    expect(SUPPORTED_CURRENCIES.slice(0, 4).map((item) => item.code)).toEqual([
      "CNY",
      "USD",
      "EUR",
      "GBP",
    ]);
  });

  it("lists the rest alphabetically by name", () => {
    const names = SUPPORTED_CURRENCIES.slice(4).map((item) => item.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("holds well-formed, unique, circulating entries", () => {
    for (const currency of SUPPORTED_CURRENCIES) {
      expect(currency.code).toMatch(/^[A-Z]{3}$/);
      expect(currency.name.length).toBeGreaterThan(0);
      expect(currency.symbol.length).toBeGreaterThan(0);
    }
    expect(SUPPORTED_CURRENCY_CODES.size).toBe(SUPPORTED_CURRENCIES.length);
    // Units of account nobody is paid in.
    expect(SUPPORTED_CURRENCY_CODES.has("XDR")).toBe(false);
    expect(SUPPORTED_CURRENCY_CODES.has("XSU")).toBe(false);
  });
});

describe("currency validation at the API boundary", () => {
  it("accepts an exchange between any two supported currencies", async () => {
    // The peer exchange endpoint is where the list is enforced. Before the
    // list covered the world, a student offering rupees for yuan was told to
    // "select a supported currency".
    const { communityExchangeOfferSchema } = await import("@/lib/validation");
    for (const have of ["PKR", "IDR", "KZT", "RUB", "THB", "XAF"]) {
      const parsed = communityExchangeOfferSchema.safeParse({
        cityId: "clq0000000000000000000000",
        haveCurrency: have,
        needCurrency: "CNY",
        haveAmount: "500",
        needAmount: "1200",
      });
      expect(parsed.success, `${have} → CNY should be offerable`).toBe(true);
    }
  });

  it("still rejects a currency that does not circulate", async () => {
    const { communityExchangeOfferSchema } = await import("@/lib/validation");
    const parsed = communityExchangeOfferSchema.safeParse({
      cityId: "clq0000000000000000000000",
      haveCurrency: "XDR",
      needCurrency: "CNY",
      haveAmount: "500",
      needAmount: "1200",
    });
    expect(parsed.success).toBe(false);
  });
});
