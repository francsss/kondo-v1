import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Baidu map Content Security Policy", () => {
  it("allows the complete JSAPI 4 vector pipeline without widening all origins", () => {
    const nextConfig = readFileSync(
      new URL("../../next.config.mjs", import.meta.url),
      "utf8",
    );

    expect(nextConfig).toContain("'wasm-unsafe-eval'");
    expect(nextConfig).toContain("`connect-src 'self' data: blob: https: wss:");
    expect(nextConfig).toContain(
      "worker-src 'self' blob: data: https://api.map.baidu.com",
    );
    expect(nextConfig).toContain(
      "child-src 'self' blob: https://api.map.baidu.com",
    );
    expect(nextConfig).not.toContain("worker-src *");
  });
});
