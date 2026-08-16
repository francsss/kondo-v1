import { describe, expect, it } from "vitest";
import { opportunityAuthoringSchema } from "@/features/opportunities/schemas";

/**
 * The bug this guards against.
 *
 * `Number("")` is `0`. An untouched salary box therefore serialised as
 * `salaryMinMinor: 0` — a stated compensation of nothing — while the currency
 * was only sent when an amount had actually been typed. The schema's rule
 * "a stated compensation needs a currency" then rejected every internship or
 * job published without a salary, naming a field the publisher had never
 * filled in and had no way to empty.
 *
 * These assert the contract at the boundary the editor posts to, so a
 * regression in the client's number handling shows up as a failing test rather
 * than as an organization that cannot publish a job.
 */

function draft(overrides: Record<string, unknown> = {}) {
  return {
    type: "INTERNSHIP",
    title: "Software Engineering Intern",
    shortDescription:
      "A paid six-month software engineering internship based in Jiaxing.",
    description:
      "You will work alongside two product engineers on the Kondo platform, shipping to production within your first weeks.",
    degreeLevels: [],
    fieldsOfStudy: [],
    languages: [],
    workMode: "UNSPECIFIED",
    applicationMethod: "KONDO_APPLICATION",
    rollingApplications: false,
    timezone: "Asia/Shanghai",
    ...overrides,
  };
}

describe("opportunity authoring payload", () => {
  it("accepts a job with no compensation stated at all", () => {
    const parsed = opportunityAuthoringSchema.safeParse({
      draft: draft(),
      job: {
        employmentType: "INTERNSHIP",
        experienceLevel: "UNSPECIFIED",
        // What an untouched salary must serialise as.
        salaryMinMinor: null,
        salaryMaxMinor: null,
        salaryCurrency: null,
        salaryPeriod: null,
        paid: null,
      },
    });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("still requires a currency when a salary really is stated", () => {
    const parsed = opportunityAuthoringSchema.safeParse({
      draft: draft(),
      job: {
        employmentType: "INTERNSHIP",
        experienceLevel: "UNSPECIFIED",
        salaryMinMinor: 800_000,
        salaryMaxMinor: null,
        salaryCurrency: null,
        salaryPeriod: null,
        paid: true,
      },
    });

    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain("salaryCurrency");
  });

  it("rejects the zero that the empty field used to produce", () => {
    /*
     * The exact shape the editor used to post. It must still fail validation —
     * the schema is right that a stated compensation needs a currency. The fix
     * belongs in the client, which should never have called an empty box zero.
     */
    const parsed = opportunityAuthoringSchema.safeParse({
      draft: draft(),
      job: {
        employmentType: "INTERNSHIP",
        experienceLevel: "UNSPECIFIED",
        salaryMinMinor: 0,
        salaryMaxMinor: 0,
        salaryCurrency: null,
        salaryPeriod: null,
        paid: null,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a scholarship with no stipend stated", () => {
    const parsed = opportunityAuthoringSchema.safeParse({
      draft: draft({ type: "SCHOLARSHIP" }),
      scholarship: {
        fundingType: "FULLY_FUNDED",
        monthlyStipendMinor: null,
        stipendCurrency: null,
      },
    });

    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });
});
