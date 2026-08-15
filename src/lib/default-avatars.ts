/**
 * The Kondo default avatars.
 *
 * Everyone on Kondo has a face. Before this, a student without an uploaded
 * photo got their initials on a generated gradient — legible, but not a
 * character, and five hundred of them in a list looked like a spreadsheet.
 *
 * These five are one family: the same circular frame, the same flat geometry,
 * the same weight of shape, drawn so they stay readable at 24px in a message
 * list and still look deliberate at 128px on a profile. They are original
 * drawings, not likenesses of anything published.
 *
 * Assignment is derived from the user's ID, so a person keeps the same face on
 * every page and every session without anything being written to the database.
 * The moment they upload a photo, the photo wins — a default is never stored
 * and so can never overwrite a real one.
 */

export type DefaultAvatar = {
  key: string;
  src: string;
  /** Used for the accessible description when no name is available. */
  label: string;
};

export const DEFAULT_AVATARS: readonly DefaultAvatar[] = [
  { key: "crocodile", src: "/avatars/kondo-crocodile.svg", label: "crocodile" },
  { key: "panda", src: "/avatars/kondo-panda.svg", label: "panda" },
  { key: "tiger", src: "/avatars/kondo-tiger.svg", label: "tiger" },
  { key: "fox", src: "/avatars/kondo-fox.svg", label: "fox" },
  { key: "owl", src: "/avatars/kondo-owl.svg", label: "owl" },
] as const;

/**
 * FNV-1a. Small, dependency-free, and — the only property that matters here —
 * identical every time for the same input, which is what keeps a student's
 * face from changing between two pages.
 */
function stableHash(value: string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** The same seed always resolves to the same avatar. */
export function defaultAvatarFor(seed: string): DefaultAvatar {
  const key = seed?.trim() || "kondo";
  return DEFAULT_AVATARS[stableHash(key) % DEFAULT_AVATARS.length]!;
}

export function defaultAvatarSrc(seed: string) {
  return defaultAvatarFor(seed).src;
}
