import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

import { adminInternalError, authorizeAdminApi } from "@/lib/admin-auth";

describe("admin API authorization", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns 401 without a session and 403 without the requested permission", async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const anonymous = await authorizeAdminApi("REPORT_LIST");
    expect(anonymous.authorized).toBe(false);
    if (!anonymous.authorized) {
      expect(anonymous.error.status).toBe(401);
      expect(anonymous.error.headers.get("cache-control")).toBe(
        "private, no-store, max-age=0",
      );
      expect(anonymous.error.headers.get("vary")).toBe("Cookie");
    }

    mocks.getCurrentUser.mockResolvedValueOnce({
      id: "member-1",
      role: "MEMBER",
    });
    const member = await authorizeAdminApi("REPORT_LIST");
    expect(member.authorized).toBe(false);
    if (!member.authorized) expect(member.error.status).toBe(403);
  });

  it("applies the role-specific permission matrix on the server", async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "moderator-1",
      role: "MODERATOR",
    });
    expect((await authorizeAdminApi("REPORT_LIST")).authorized).toBe(true);
    expect((await authorizeAdminApi("REPORT_ASSIGN_ANY")).authorized).toBe(
      false,
    );

    mocks.getCurrentUser.mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
    });
    expect((await authorizeAdminApi("REPORT_ASSIGN_ANY")).authorized).toBe(
      true,
    );
    expect(
      (await authorizeAdminApi("AUDIT_VIEW_SECURITY_METADATA")).authorized,
    ).toBe(false);

    mocks.getCurrentUser.mockResolvedValue({
      id: "super-1",
      role: "SUPER_ADMIN",
    });
    expect(
      (await authorizeAdminApi("AUDIT_VIEW_SECURITY_METADATA")).authorized,
    ).toBe(true);
  });

  it("returns a controlled error without logging sensitive exception text", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = adminInternalError(
      "admin.test",
      new Error("password=secret database row"),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "An unexpected server error occurred.",
    });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(consoleError.mock.calls[0]?.[0]).not.toContain("password=secret");
    consoleError.mockRestore();
  });
});
