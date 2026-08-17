import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Alipay sandbox Content Security Policy", () => {
  it("allows form submission only to the reviewed sandbox gateways", () => {
    const nextConfig = readFileSync(
      new URL("../../next.config.mjs", import.meta.url),
      "utf8",
    );

    expect(nextConfig).toContain(
      "form-action 'self' https://openapi-sandbox.dl.alipaydev.com https://openapi.alipaydev.com",
    );
    expect(nextConfig).not.toContain("form-action 'self' *");
    expect(nextConfig).not.toContain("https://openapi.alipay.com");
  });
});
