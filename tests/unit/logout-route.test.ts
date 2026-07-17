import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revokeDatabaseSession: vi.fn(),
  verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...original,
    verifySessionToken: mocks.verifySessionToken,
  };
});

vi.mock("@/lib/server-auth", () => ({
  revokeDatabaseSession: mocks.revokeDatabaseSession,
}));

import { POST } from "../../app/api/auth/logout/route";

describe("logout session revocation", () => {
  afterEach(() => vi.clearAllMocks());

  it("revokes the database session and clears the same browser cookie", async () => {
    mocks.verifySessionToken.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      role: "MEMBER",
      sessionId: "session-id",
    });
    mocks.revokeDatabaseSession.mockResolvedValue({ count: 1 });

    const response = await POST(
      new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: "kondo_session=signed-token",
          host: "localhost:3000",
          origin: "http://localhost:3000",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.revokeDatabaseSession).toHaveBeenCalledWith({
      sessionId: "session-id",
      userId: "user-1",
    });
    expect(response.headers.get("set-cookie")).toContain("kondo_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
