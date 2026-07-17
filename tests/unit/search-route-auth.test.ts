import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  searchKondo: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/platform-queries", () => ({
  searchKondo: mocks.searchKondo,
}));

import { GET } from "../../app/api/search/route";

describe("search API authentication and caching", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("returns 401 before searching when no session exists", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await GET(
      new NextRequest("http://localhost:3000/api/search?q=jiaxing"),
    );

    expect(response.status).toBe(401);
    expect(mocks.searchKondo).not.toHaveBeenCalled();
  });

  it("uses the authenticated viewer and disables shared caching", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.searchKondo.mockResolvedValue({
      communities: [],
      listings: [],
      guides: [],
      questions: [],
      users: [],
      posts: [],
    });
    const response = await GET(
      new NextRequest("http://localhost:3000/api/search?q=jiaxing"),
    );

    expect(response.status).toBe(200);
    expect(mocks.searchKondo).toHaveBeenCalledWith("jiaxing", "viewer-1");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("vary")).toBe("Cookie");
  });

  it("returns a controlled error when the search backend fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.searchKondo.mockRejectedValue(
      new Error("Prisma query and private data"),
    );

    const response = await GET(
      new NextRequest("http://localhost:3000/api/search?q=jiaxing"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "An unexpected server error occurred.",
    });
  });
});
