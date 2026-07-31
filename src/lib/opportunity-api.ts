import { ZodError, type ZodIssue } from "zod";
import { internalApiError, jsonError } from "@/lib/request";

/**
 * Maps the Opportunity domain's typed errors onto HTTP responses. Anything
 * that is not a recognized domain error becomes a generic 500 so an internal
 * message can never leak through an API response.
 */

/** `draft.shortDescription` → "Short description". */
function fieldLabel(issue: ZodIssue) {
  const segment = [...issue.path]
    .reverse()
    .find((part) => typeof part === "string" && part !== "draft");
  if (typeof segment !== "string") return null;
  const words = segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim()
    // Initialisms would otherwise read as "External application url".
    .replace(/\b(url|id|cv)\b/g, (match) => match.toUpperCase());
  return words ? words[0].toUpperCase() + words.slice(1) : null;
}

/**
 * Zod's built-in length wording is accurate but reads like a stack trace, so
 * the common cases are rewritten as fragments that read after a field name.
 * A schema's own `message` is already a complete sentence and is returned as
 * one, because prefixing "Add the official link." with a label makes nonsense.
 */
function readableMessage(issue: ZodIssue): {
  text: string;
  fragment: boolean;
} {
  if (issue.code === "too_small" && issue.type === "string") {
    return {
      text: `must be at least ${issue.minimum} characters`,
      fragment: true,
    };
  }
  if (issue.code === "too_big" && issue.type === "string") {
    return {
      text: `must be ${issue.maximum} characters or fewer`,
      fragment: true,
    };
  }
  if (issue.code === "invalid_type" && issue.received === "undefined") {
    return { text: "is required", fragment: true };
  }
  return { text: issue.message.trim(), fragment: false };
}

/**
 * Turns a schema failure into one sentence naming the field that failed.
 *
 * A publisher who mistypes a URL or writes too short a description must be told
 * which field to fix. Zod issues describe the caller's own submitted input, so
 * surfacing one leaks nothing about the server.
 */
export function describeOpportunityValidation(error: ZodError) {
  const issue = error.issues[0];
  if (!issue) return "Check the opportunity details and try again.";
  const label = fieldLabel(issue);
  const { text, fragment } = readableMessage(issue);
  if (!fragment) {
    // A complete sentence stands alone, but still names its field so a
    // publisher knows where to look on a long form.
    return label && !text.toLowerCase().includes(label.toLowerCase())
      ? `${label}: ${text}`
      : text || "Check the opportunity details and try again.";
  }
  return label ? `${label} ${text}` : text;
}

export function opportunityApiFailure(event: string, error: unknown) {
  // A rejected payload is the caller's mistake, not a server fault. Reporting
  // it as 500 "unexpected server error" left publishers with nothing to act on.
  if (error instanceof ZodError) {
    return jsonError(describeOpportunityValidation(error), 400);
  }
  if (error instanceof SyntaxError) {
    return jsonError("The request body was not valid JSON.", 400);
  }
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
