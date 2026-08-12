import { describe, expect, it } from "vitest";
import {
  formatEssentialPrice,
  isOrderable,
  isStudyEssentialFilter,
  STUDY_ESSENTIAL_FILTERS,
  STUDY_ESSENTIAL_PAYMENT_METHODS,
} from "@/lib/study-essentials";

describe("Study Essentials catalogue rules", () => {
  it("only lets a Kondo item with a price be bought on Kondo", () => {
    expect(
      isOrderable({ source: "KONDO", priceMinor: 13900, externalUrl: null }),
    ).toBe(true);
    // A partner item is bought on the partner's own platform, even when the
    // partner happens to publish a price.
    expect(
      isOrderable({
        source: "PARTNER",
        priceMinor: 9900,
        externalUrl: "https://example.org",
      }),
    ).toBe(false);
    // A Kondo item without a price has nothing to charge.
    expect(
      isOrderable({ source: "KONDO", priceMinor: null, externalUrl: null }),
    ).toBe(false);
  });

  it("treats a zero price as free rather than as missing", () => {
    expect(formatEssentialPrice(0, "CNY")).toBe("Free");
    expect(formatEssentialPrice(null, "CNY")).toBeNull();
  });

  it("drops trailing decimals only when the price is a round unit", () => {
    expect(formatEssentialPrice(13900, "CNY")).toBe("¥139");
    expect(formatEssentialPrice(13950, "CNY")).toBe("¥139.50");
  });

  it("accepts only the declared catalogue filters", () => {
    for (const { key } of STUDY_ESSENTIAL_FILTERS) {
      expect(isStudyEssentialFilter(key)).toBe(true);
    }
    expect(isStudyEssentialFilter("everything")).toBe(false);
    expect(isStudyEssentialFilter(undefined)).toBe(false);
  });

  it("offers exactly one usable payment method while payments are simulated", () => {
    const usable = STUDY_ESSENTIAL_PAYMENT_METHODS.filter(
      (method) => method.available,
    );
    expect(usable.map(({ key }) => key)).toEqual(["SIMULATED"]);
    // The real providers are declared so enabling one is an adapter change.
    expect(STUDY_ESSENTIAL_PAYMENT_METHODS.map(({ key }) => key)).toContain(
      "ALIPAY",
    );
    expect(STUDY_ESSENTIAL_PAYMENT_METHODS.map(({ key }) => key)).toContain(
      "WECHAT_PAY",
    );
  });
});
