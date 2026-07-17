import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_COOKIE_NAME,
  clearSessionCookie,
  setSessionCookie,
} from "@/lib/auth";

describe("session cookie transport", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sets a host-only HTTP cookie for local-network IP access", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://192.168.31.49:3000/api/auth/login");
    const response = NextResponse.json({ ok: true });

    setSessionCookie(request, response, "signed-token");

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${AUTH_COOKIE_NAME}=signed-token`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    expect(setCookie).not.toContain("Domain=");
  });

  it("sets Secure when Vercel forwards an HTTPS request", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest("http://internal-host/api/auth/login", {
      headers: { "x-forwarded-proto": "https" },
    });
    const response = NextResponse.json({ ok: true });

    setSessionCookie(request, response, "signed-token");

    expect(response.headers.get("set-cookie")).toMatch(/;\s*Secure/i);
  });

  it("does not set Secure in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest("https://localhost:3000/api/auth/login");
    const response = NextResponse.json({ ok: true });

    setSessionCookie(request, response, "signed-token");

    expect(response.headers.get("set-cookie")).not.toMatch(/;\s*Secure/i);
  });

  it("clears the cookie with the same scope and transport policy", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest(
      "http://192.168.31.49:3000/api/auth/logout",
    );
    const response = NextResponse.json({ ok: true });

    clearSessionCookie(request, response);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`${AUTH_COOKIE_NAME}=`);
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).not.toMatch(/;\s*Secure/i);
  });
});
