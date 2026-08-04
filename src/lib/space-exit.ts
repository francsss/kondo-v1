/**
 * Where the member was before entering one of Kondo's dedicated spaces.
 *
 * The Student Hub and organization profiles deliberately drop the global app
 * shell, which means their back button cannot simply step back one entry in
 * history — inside a space with its own tabs, one step back is another page of
 * the same space, so the control would read as "previous tab" rather than
 * "leave". `AppShell` writes the current path here on every navigation while
 * the member is still in the main app, and the space's back button reads it.
 */
export const LAST_MAIN_PATH_KEY = "kondo:last-main-path";

/**
 * The path to return to when leaving a space, or `null` to use the caller's
 * fallback. A recorded path that already sits inside the space is not a way
 * out — that happens on a direct landing, where the space is all the member
 * has seen.
 */
export function resolveSpaceExitPath(
  recorded: string | null,
  spacePrefix: string,
): string | null {
  if (!recorded) return null;
  if (!recorded.startsWith("/")) return null;
  // Guard against a protocol-relative or escaped value being used as a target.
  if (recorded.startsWith("//") || recorded.includes("\\")) return null;
  if (recorded === spacePrefix || recorded.startsWith(`${spacePrefix}/`)) {
    return null;
  }
  return recorded;
}
