import { internalApiError, jsonError } from "@/lib/request";

/**
 * Maps the Opportunity domain's typed errors onto HTTP responses. Anything
 * that is not a recognized domain error becomes a generic 500 so an internal
 * message can never leak through an API response.
 */
export function opportunityApiFailure(event: string, error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    /^Opportunity/.test(error.name)
  ) {
    return jsonError(error.message, error.status);
  }
  return internalApiError(event, error);
}

export function splitQueryValues(value: string | null) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}
