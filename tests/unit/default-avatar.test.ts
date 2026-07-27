import { describe, expect, it } from "vitest";
import { defaultAvatarDataUri } from "@/lib/presentation";

describe("generated default avatars", () => {
  it("is deterministic for one account and distinct across account seeds", () => {
    const first = defaultAvatarDataUri("Ama", "Mensah", "user-1");
    expect(defaultAvatarDataUri("Ama", "Mensah", "user-1")).toBe(first);
    expect(defaultAvatarDataUri("Ama", "Mensah", "user-2")).not.toBe(first);
    expect(first).toMatch(/^data:image\/svg\+xml,/);
  });

  it("encodes unsafe name characters instead of injecting SVG markup", () => {
    const avatar = decodeURIComponent(
      defaultAvatarDataUri("<A", "&B", "safe-user").split(",", 2)[1] ?? "",
    );
    expect(avatar).toContain("&lt;&amp;");
    expect(avatar).not.toContain("<A");
  });
});
