import { describe, expect, it } from "vitest";
import { audienceAllows } from "@/lib/profiles";

describe("profile audience policy", () => {
  const owner = { id: "owner", role: "MEMBER" };
  const member = { id: "member", role: "MEMBER" };
  const admin = { id: "admin", role: "ADMIN" };
  const moderator = { id: "moderator", role: "MODERATOR" };

  it("keeps private sections owner/Admin-only", () => {
    expect(audienceAllows("PRIVATE", "owner", owner)).toBe(true);
    expect(audienceAllows("PRIVATE", "owner", admin)).toBe(true);
    expect(audienceAllows("PRIVATE", "owner", member)).toBe(false);
    expect(audienceAllows("PRIVATE", "owner", moderator)).toBe(false);
    expect(audienceAllows("PRIVATE", "owner", null)).toBe(false);
  });

  it("separates public and member audiences", () => {
    expect(audienceAllows("PUBLIC", "owner", null)).toBe(true);
    expect(audienceAllows("MEMBERS", "owner", member)).toBe(true);
    expect(audienceAllows("MEMBERS", "owner", null)).toBe(false);
  });
});
