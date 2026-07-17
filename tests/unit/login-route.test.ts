import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  passwordCompare: vi.fn(),
  sessionCreate: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mocks.passwordCompare },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: { create: mocks.auditCreate },
    session: { create: mocks.sessionCreate },
    $transaction: mocks.transaction,
    user: { findUnique: mocks.userFindUnique },
  },
}));

import { POST } from "../../app/api/auth/login/route";

describe("login route session delivery", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("creates a database session and returns a usable LAN cookie", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", "unit-test-secret-with-at-least-32-bytes");
    mocks.passwordCompare.mockResolvedValue(true);
    mocks.auditCreate.mockResolvedValue({ id: "audit-1" });
    mocks.sessionCreate.mockResolvedValue({ id: "session-1" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        auditLog: { create: mocks.auditCreate },
        session: { create: mocks.sessionCreate },
      }),
    );
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "ama@example.com",
      passwordHash: "stored-hash",
      firstName: "Ama",
      lastName: "Mensah",
      username: "ama-mensah",
      avatarKey: null,
      role: "MEMBER",
      status: "ACTIVE",
      onboardingCompletedAt: new Date(),
    });

    const request = new NextRequest(
      "http://192.168.31.49:3000/api/auth/login",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "192.168.31.49:3000",
          origin: "http://192.168.31.49:3000",
        },
        body: JSON.stringify({
          email: "ama@example.com",
          password: "ChangeMe123!",
        }),
      },
    );

    const response = await POST(request);
    const setCookie = response.headers.get("set-cookie");

    expect(response.status).toBe(200);
    expect(mocks.sessionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(setCookie).toContain("kondo_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).not.toMatch(/;\s*Secure/i);
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "LOGIN_SUCCESS",
        actorId: "user-1",
      }),
    });
  });

  it("does not write an email or password into failed-login logs", async () => {
    mocks.passwordCompare.mockResolvedValue(false);
    mocks.auditCreate.mockResolvedValue({ id: "audit-2" });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      email: "private@example.com",
      passwordHash: "stored-hash",
      status: "ACTIVE",
    });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          email: "private@example.com",
          password: "NeverLogThis123!",
        }),
      }),
    );

    expect(response.status).toBe(401);
    const auditCall = mocks.auditCreate.mock.calls[0]?.[0];
    expect(JSON.stringify(auditCall)).not.toContain("private@example.com");
    expect(JSON.stringify(auditCall)).not.toContain("NeverLogThis123!");
    expect(auditCall).toEqual({
      data: expect.objectContaining({
        action: "LOGIN_FAILED",
        entityType: "Credential",
        entityId: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });
});
