import { describe, expect, it } from "vitest";
import { getMarketplaceSubmitIntent } from "@/lib/marketplace-form";

describe("marketplace listing form intent", () => {
  it.each(["draft", "publish", "save"] as const)(
    "reads the %s intent from the button that submitted the form",
    (value) => {
      expect(getMarketplaceSubmitIntent({ name: "intent", value })).toBe(value);
    },
  );

  it("does not infer an intent when the submitter is missing or invalid", () => {
    expect(getMarketplaceSubmitIntent(null)).toBeNull();
    expect(
      getMarketplaceSubmitIntent({ name: "other", value: "publish" }),
    ).toBeNull();
    expect(
      getMarketplaceSubmitIntent({ name: "intent", value: "unknown" }),
    ).toBeNull();
  });
});
