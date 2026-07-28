import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Baidu map Content Security Policy", () => {
  it("allows the JSAPI 4 vector worker without widening all worker origins", () => {
    const nextConfig = readFileSync(
      new URL("../../next.config.mjs", import.meta.url),
      "utf8",
    );

    expect(nextConfig).toContain(
      "worker-src 'self' blob: data: https://api.map.baidu.com",
    );
    expect(nextConfig).toContain(
      "child-src 'self' blob: https://api.map.baidu.com",
    );
    expect(nextConfig).not.toContain("worker-src *");
  });
});
