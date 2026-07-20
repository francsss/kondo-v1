import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hasTrustedOrigin } from "@/lib/request";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("trusted request origins", () => {
  it("accepts the exact externally forwarded HTTPS origin", () => {
    const request = new NextRequest("http://internal/api/profile", {
      headers: {
        host: "internal",
        origin: "https://kondo.app",
        "x-forwarded-host": "kondo.app",
        "x-forwarded-proto": "https",
      },
    });

    expect(hasTrustedOrigin(request)).toBe(true);
  });

  it("rejects cross-scheme and cross-host origins", () => {
    const crossScheme = new NextRequest("https://kondo.app/api/profile", {
      headers: { origin: "http://kondo.app" },
    });
    const crossHost = new NextRequest("https://kondo.app/api/profile", {
      headers: { origin: "https://attacker.test" },
    });

    expect(hasTrustedOrigin(crossScheme)).toBe(false);
    expect(hasTrustedOrigin(crossHost)).toBe(false);
  });

  it("rejects missing Origin headers in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const request = new NextRequest("https://kondo.app/api/profile");

    expect(hasTrustedOrigin(request)).toBe(false);
  });
});
