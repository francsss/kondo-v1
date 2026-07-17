import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  blockDeleteMany: vi.fn(),
  blockUpsert: vi.fn(),
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  transaction: vi.fn(),
  userFindUnique: vi.fn(),
}));

const transactionClient = {
  auditLog: { create: vi.fn() },
  user: { findUnique: mocks.userFindUnique },
  userBlock: {
    deleteMany: mocks.blockDeleteMany,
    upsert: mocks.blockUpsert,
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLogWithClient: mocks.audit,
}));

import { DELETE, POST } from "../../app/api/users/[id]/block/route";

const request = (method: string) =>
  new NextRequest("http://localhost:3000/api/users/target-1/block", {
    method,
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
  });

describe("block and unblock workflow", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "member-1",
      role: "MEMBER",
    });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.transaction.mockImplementation(
      async (callback: (tx: typeof transactionClient) => unknown) =>
        callback(transactionClient),
    );
    mocks.userFindUnique.mockResolvedValue({ id: "target-1" });
    mocks.blockUpsert.mockResolvedValue({});
    mocks.blockDeleteMany.mockResolvedValue({ count: 1 });
    mocks.audit.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("blocks an existing user and audits within the same transaction", async () => {
    const response = await POST(request("POST"), {
      params: Promise.resolve({ id: "target-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blocked: true });
    expect(mocks.blockUpsert).toHaveBeenCalledWith({
      where: {
        blockerId_blockedId: {
          blockerId: "member-1",
          blockedId: "target-1",
        },
      },
      create: { blockerId: "member-1", blockedId: "target-1" },
      update: {},
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({
        actorId: "member-1",
        action: "USER_BLOCKED",
        entityType: "User",
        entityId: "target-1",
      }),
    );
  });

  it("unblocks and audits idempotently", async () => {
    const response = await DELETE(request("DELETE"), {
      params: Promise.resolve({ id: "target-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blocked: false });
    expect(mocks.blockDeleteMany).toHaveBeenCalledWith({
      where: { blockerId: "member-1", blockedId: "target-1" },
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      transactionClient,
      expect.objectContaining({ action: "USER_UNBLOCKED" }),
    );
  });

  it("returns 404 without writing a block or audit for a missing target", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    const response = await POST(request("POST"), {
      params: Promise.resolve({ id: "target-1" }),
    });

    expect(response.status).toBe(404);
    expect(mocks.blockUpsert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects self-blocking before opening a transaction", async () => {
    const response = await POST(request("POST"), {
      params: Promise.resolve({ id: "member-1" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns a controlled error after an audit failure rolls back the transaction", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.audit.mockRejectedValue(new Error("audit unavailable"));
    const response = await POST(request("POST"), {
      params: Promise.resolve({ id: "target-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "An unexpected server error occurred.",
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
});
