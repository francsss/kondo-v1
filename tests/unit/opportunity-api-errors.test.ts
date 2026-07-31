import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OpportunityError } from "@/lib/opportunities";
import { opportunityAuthoringSchema } from "@/features/opportunities/schemas";
import {
  describeOpportunityValidation,
  opportunityApiFailure,
} from "@/lib/opportunity-api";
import { OpportunityAccessError } from "@/lib/opportunity-permissions";

async function body(response: Response) {
  return (await response.json()) as { error?: string };
}

function failAuthoring(draft: Record<string, unknown>) {
  const parsed = opportunityAuthoringSchema.safeParse({
    draft: {
      type: "SCHOLARSHIP",
      title: "A valid scholarship title for the test",
      shortDescription:
        "A short description that is comfortably past the minimum length.",
      description:
        "A description that is comfortably past the fifty character minimum length rule.",
      applicationMethod: "KONDO_APPLICATION",
      ...draft,
    },
    scholarship: { fundingType: "FULLY_FUNDED" },
  });
  if (parsed.success) throw new Error("expected the payload to be rejected");
  return parsed.error;
}

describe("opportunity API failure mapping", () => {
  it("answers 400 and names the field when the payload is rejected", async () => {
    // Regression: a rejected payload used to fall through to a generic 500,
    // leaving a publisher with "An unexpected server error occurred." and no
    // indication of which field to fix.
    const response = opportunityApiFailure(
      "test",
      failAuthoring({ shortDescription: "short" }),
    );
    expect(response.status).toBe(400);
    const payload = await body(response);
    expect(payload.error).toBe(
      "Short description must be at least 20 characters",
    );
    expect(payload.error).not.toContain("unexpected server error");
  });

  it("keeps a schema's own sentence intact instead of mangling its grammar", async () => {
    const response = opportunityApiFailure(
      "test",
      failAuthoring({ applicationMethod: "EXTERNAL_URL" }),
    );
    expect(response.status).toBe(400);
    expect((await body(response)).error).toBe(
      "External application URL: Add the official application web address.",
    );
  });

  it("reports a missing required field as required", () => {
    expect(
      describeOpportunityValidation(failAuthoring({ title: undefined })),
    ).toBe("Title is required");
  });

  it("uppercases initialisms rather than writing 'url'", () => {
    const message = describeOpportunityValidation(
      failAuthoring({
        applicationMethod: "EXTERNAL_URL",
        externalApplicationUrl: "javascript:alert(1)",
        officialSourceUrl: "https://example.edu/source",
      }),
    );
    expect(message).toContain("External application URL");
    expect(message).not.toContain("url:");
  });

  it("falls back to safe copy when an error carries no issues", () => {
    expect(describeOpportunityValidation(new z.ZodError([]))).toBe(
      "Check the opportunity details and try again.",
    );
  });

  it("answers 400 for a malformed JSON body", async () => {
    const response = opportunityApiFailure(
      "test",
      new SyntaxError("Unexpected token < in JSON at position 0"),
    );
    expect(response.status).toBe(400);
    const payload = await body(response);
    expect(payload.error).toBe("The request body was not valid JSON.");
    // The parser's own message is never echoed back.
    expect(payload.error).not.toContain("Unexpected token");
  });

  it("preserves a domain error's status and message", async () => {
    const denied = opportunityApiFailure(
      "test",
      new OpportunityAccessError("You do not have workspace access.", 403),
    );
    expect(denied.status).toBe(403);
    expect((await body(denied)).error).toBe(
      "You do not have workspace access.",
    );

    const notReady = opportunityApiFailure(
      "test",
      new OpportunityError(
        "Complete the scholarship funding details before publishing.",
        400,
      ),
    );
    expect(notReady.status).toBe(400);
    expect((await body(notReady)).error).toBe(
      "Complete the scholarship funding details before publishing.",
    );
  });

  it("still hides a genuinely unexpected failure behind a generic 500", async () => {
    const response = opportunityApiFailure(
      "test",
      new Error("connect ECONNREFUSED 10.0.0.7:5432"),
    );
    expect(response.status).toBe(500);
    const payload = await body(response);
    expect(payload.error).toBe("An unexpected server error occurred.");
    expect(payload.error).not.toContain("ECONNREFUSED");
  });
});
