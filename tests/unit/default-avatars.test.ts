import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_AVATARS, defaultAvatarFor } from "@/lib/default-avatars";

describe("Kondo default avatars", () => {
  it("ships five of them", () => {
    expect(DEFAULT_AVATARS).toHaveLength(5);
    expect(new Set(DEFAULT_AVATARS.map((a) => a.key)).size).toBe(5);
  });

  it("resolves the same avatar for the same user every time", () => {
    for (const id of ["user-1", "cmsrsglio007f12uhttjeqnnf", "z", "48"]) {
      const first = defaultAvatarFor(id);
      for (let attempt = 0; attempt < 25; attempt += 1) {
        expect(defaultAvatarFor(id)).toBe(first);
      }
    }
  });

  it("gives different users different faces rather than one for everyone", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `user-${index}`);
    const used = new Set(ids.map((id) => defaultAvatarFor(id).key));
    expect(used.size).toBe(5);
  });

  it("spreads users across the set without heavy bias", () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < 1000; index += 1) {
      const key = defaultAvatarFor(`kondo-user-${index}`).key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // Perfectly even would be 200 each; allow a wide but bounded spread.
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(100);
      expect(count).toBeLessThan(320);
    }
  });

  it("never returns nothing, even for an empty seed", () => {
    expect(defaultAvatarFor("")).toBeDefined();
    expect(defaultAvatarFor("   ")).toBeDefined();
  });

  it("points at asset files that exist and are small and sharp", () => {
    for (const avatar of DEFAULT_AVATARS) {
      expect(avatar.src).toMatch(/^\/avatars\/kondo-[a-z]+\.svg$/);
      const file = readFileSync(`public${avatar.src}`, "utf8");
      // Vector, so sharp at any size, and small enough to be free.
      expect(file).toContain("<svg");
      expect(file).toContain('viewBox="0 0 96 96"');
      expect(file.length).toBeLessThan(4000);
      /*
       * No external references: an avatar must never depend on the network.
       * The `xmlns` declaration is a namespace identifier, not a fetch, so
       * only actual resource references are checked.
       */
      expect(file).not.toMatch(/(?:href|src)\s*=\s*["']https?:\/\//);
      expect(file).not.toMatch(/url\(\s*["']?https?:\/\//);
      expect(file).not.toContain("<image");
    }
  });
});
