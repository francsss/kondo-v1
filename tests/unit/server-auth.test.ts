import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionDeleteMany: vi.fn(),
  sessionFindUnique: vi.fn(),
  verifySessionToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "kondo_session",
  verifySessionToken: mocks.verifySessionToken,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      deleteMany: mocks.sessionDeleteMany,
      findUnique: mocks.sessionFindUnique,
    },
  },
}));

import { resolveAuthenticatedUser } from "@/lib/server-auth";

const activeUser = {
  id: "user-1",
  email: "member@example.com",
  firstName: "Active",
  lastName: "Member",
  username: "active-member",
  avatarKey: null,
  role: "ADMIN",
  status: "ACTIVE",
  onboardingCompletedAt: new Date(),
  createdAt: new Date(),
  country: null,
  city: null,
  university: null,
};

function databaseSession(
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED" = "ACTIVE",
) {
  return {
    userId: "user-1",
    expiresAt: new Date(Date.now() + 60_000),
    user: { ...activeUser, status },
  };
}

describe("database-backed session resolution", () => {
  afterEach(() => vi.clearAllMocks());

  it("uses the current database role instead of the role embedded in the token", async () => {
    mocks.verifySessionToken.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      role: "MEMBER",
      sessionId: "session-token",
    });
    mocks.sessionFindUnique.mockResolvedValue(databaseSession());

    const user = await resolveAuthenticatedUser("signed-token");

    expect(user?.role).toBe("ADMIN");
    expect(mocks.sessionFindUnique).toHaveBeenCalledOnce();
  });

  it.each(["SUSPENDED", "DEACTIVATED"] as const)(
    "rejects an otherwise valid session for a %s user",
    async (status) => {
      mocks.verifySessionToken.mockResolvedValue({
        id: "user-1",
        email: "member@example.com",
        role: "MEMBER",
        sessionId: "session-token",
      });
      mocks.sessionFindUnique.mockResolvedValue(databaseSession(status));

      await expect(
        resolveAuthenticatedUser("signed-token"),
      ).resolves.toBeNull();
    },
  );

  it("rejects revoked sessions and deletes an expired session on access", async () => {
    mocks.verifySessionToken.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
      role: "MEMBER",
      sessionId: "session-token",
    });
    mocks.sessionFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...databaseSession(),
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(resolveAuthenticatedUser("signed-token")).resolves.toBeNull();
    await expect(resolveAuthenticatedUser("signed-token")).resolves.toBeNull();

    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({
      where: {
        tokenHash: expect.any(String),
        userId: "user-1",
      },
    });
  });
});
