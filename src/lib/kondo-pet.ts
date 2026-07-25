export const KONDO_PET_DISPLAY_DELAY_MS = 7_000;
export const KONDO_PET_VISIBLE_DURATION_MS = 9_000;
export const KONDO_PET_SUBMISSION_SNOOZE_MS = 7 * 24 * 60 * 60 * 1_000;

const eligiblePrefixes = [
  "/communities",
  "/explore",
  "/marketplace",
  "/student-hub",
] as const;

export function isKondoPetPath(pathname: string) {
  return (
    pathname === "/home" ||
    eligiblePrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

export function kondoPetSessionKey(pathname: string) {
  if (pathname === "/home") return "kondo-pet:seen:home";
  const prefix = eligiblePrefixes.find(
    (item) => pathname === item || pathname.startsWith(`${item}/`),
  );
  return `kondo-pet:seen:${prefix ?? "other"}`;
}
