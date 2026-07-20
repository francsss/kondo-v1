import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  rateLimit: vi.fn(),
  searchKondo: vi.fn(),
  searchCategory: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
}));

vi.mock("@/lib/search", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/search")>();
  return {
    ...actual,
    searchKondo: mocks.searchKondo,
    searchCategory: mocks.searchCategory,
  };
});

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

  it("paginates a single category through searchCategory when type is set", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.searchCategory.mockResolvedValue({
      items: [{ id: "listing-1" }],
      nextCursor: "opaque-cursor",
    });
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/search?q=jiaxing&type=listings&cursor=abc&limit=5",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.searchKondo).not.toHaveBeenCalled();
    expect(mocks.searchCategory).toHaveBeenCalledWith(
      "listings",
      "jiaxing",
      "viewer-1",
      { cursor: "abc", limit: 5 },
    );
    expect(await response.json()).toEqual({
      items: [{ id: "listing-1" }],
      nextCursor: "opaque-cursor",
    });
  });

  it("rejects an unknown search category", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: "viewer-1" });
    mocks.rateLimit.mockReturnValue({ allowed: true });
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/api/search?q=jiaxing&type=not-a-category",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.searchCategory).not.toHaveBeenCalled();
  });
});
