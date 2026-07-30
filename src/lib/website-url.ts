const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export const WEBSITE_URL_ERROR =
  "Enter a valid website address, for example https://example.org.";

export function normalizeWebsiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || URL_SCHEME_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isHttpWebsiteUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname)
    );
  } catch {
    return false;
  }
}

export function normalizeOptionalWebsiteUrl(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const normalized = normalizeWebsiteUrl(value);
  return normalized || undefined;
}
