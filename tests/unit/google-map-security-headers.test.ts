import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Google Maps Content Security Policy", () => {
  it("allows the official Google Maps origins without retaining Baidu hosts", () => {
    const nextConfig = readFileSync(
      new URL("../../next.config.mjs", import.meta.url),
      "utf8",
    );

    expect(nextConfig).toContain("https://maps.googleapis.com");
    expect(nextConfig).toContain("https://maps.gstatic.com");
    expect(nextConfig).toContain("https://fonts.gstatic.com");
    expect(nextConfig).not.toContain("api.map.baidu.com");
    expect(nextConfig).not.toContain("bdimg.com");
  });
});
