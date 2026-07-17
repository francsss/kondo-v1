import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrReuseConversationReport: vi.fn(),
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/moderation", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/moderation")>();
  return {
    ...original,
    createOrReuseConversationReport: mocks.createOrReuseConversationReport,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import { POST } from "../../app/api/conversations/[id]/report/route";

function reportRequest() {
  return new NextRequest(
    "http://localhost:3000/api/conversations/conversation-1/report",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        reason: "SCAM",
        details: "The participant requested an off-platform deposit.",
      }),
    },
  );
}

describe("conversation report route foundations", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("requires authentication before rate limiting or report creation", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(reportRequest(), {
      params: Promise.resolve({ id: "conversation-1" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.createOrReuseConversationReport).not.toHaveBeenCalled();
  });

  it("keeps the report rate limit active", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "member-1" });
    mocks.rateLimit.mockReturnValue({ allowed: false });

    const response = await POST(reportRequest(), {
      params: Promise.resolve({ id: "conversation-1" }),
    });

    expect(response.status).toBe(429);
    expect(mocks.createOrReuseConversationReport).not.toHaveBeenCalled();
  });

  it("returns a generic 500 without exposing an unknown backend error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: "member-1" });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.createOrReuseConversationReport.mockRejectedValue(
      new Error("Prisma secret query detail"),
    );

    const response = await POST(reportRequest(), {
      params: Promise.resolve({ id: "conversation-1" }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "An unexpected server error occurred.",
    });
  });
});
