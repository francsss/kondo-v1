import { internalApiError, jsonError } from "@/lib/request";

export function housingApiFailure(event: string, error: unknown) {
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number" &&
    /^(Housing|Roommate)/.test(error.name)
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
