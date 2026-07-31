import { describe, expect, it } from "vitest";
import {
  CLOSING_SOON_THRESHOLD_DAYS,
  applicationWindowAcceptsSubmission,
  resolveApplicationWindow,
} from "@/lib/opportunity-application-window";
import {
  evaluateOpportunityEligibility,
  type EligibilityRuleInput,
} from "@/lib/opportunity-eligibility";
import { hasOrganizationPermission } from "@/lib/organization-authorization";

const NOW = new Date("2026-07-31T12:00:00.000Z");

function rule(overrides: Partial<EligibilityRuleInput>): EligibilityRuleInput {
  return {
    id: "rule-1",
    ruleType: "DEGREE_LEVEL",
    operator: "IN",
    structuredValue: ["BACHELORS"],
    required: true,
    publicLabel: "Open to bachelor students",
    ...overrides,
  };
}

describe("application window", () => {
  const base = {
    lifecycle: "PUBLISHED" as const,
    applicationMethod: "KONDO_APPLICATION" as const,
    now: NOW,
  };

  it("returns NOT_OPEN before the opening date", () => {
    const window = resolveApplicationWindow({
      ...base,
      applicationOpenAt: new Date("2026-08-10T00:00:00.000Z"),
    });
    expect(window.state).toBe("NOT_OPEN");
    expect(applicationWindowAcceptsSubmission(window)).toBe(false);
  });

  it("returns OPEN inside the window", () => {
    const window = resolveApplicationWindow({
      ...base,
      applicationDeadline: new Date("2026-12-01T00:00:00.000Z"),
    });
    expect(window.state).toBe("OPEN");
    expect(applicationWindowAcceptsSubmission(window)).toBe(true);
  });

  it("returns CLOSED after the deadline and refuses submission", () => {
    const window = resolveApplicationWindow({
      ...base,
      applicationDeadline: new Date("2026-07-30T00:00:00.000Z"),
    });
    expect(window.state).toBe("CLOSED");
    expect(applicationWindowAcceptsSubmission(window)).toBe(false);
  });

  it("uses a documented deterministic closing-soon threshold", () => {
    const inside = resolveApplicationWindow({
      ...base,
      applicationDeadline: new Date(
        NOW.getTime() + (CLOSING_SOON_THRESHOLD_DAYS - 1) * 86_400_000,
      ),
    });
    const outside = resolveApplicationWindow({
      ...base,
      applicationDeadline: new Date(
        NOW.getTime() + (CLOSING_SOON_THRESHOLD_DAYS + 5) * 86_400_000,
      ),
    });
    expect(inside.state).toBe("CLOSING_SOON");
    expect(outside.state).toBe("OPEN");
  });

  it("treats a rolling opportunity without a deadline as ROLLING", () => {
    const window = resolveApplicationWindow({
      ...base,
      rollingApplications: true,
    });
    expect(window.state).toBe("ROLLING");
    expect(applicationWindowAcceptsSubmission(window)).toBe(true);
  });

  it("never accepts a Kondo submission for an external or information-only method", () => {
    for (const method of ["EXTERNAL_URL", "EMAIL"] as const) {
      const window = resolveApplicationWindow({
        ...base,
        applicationMethod: method,
      });
      expect(window.state).toBe("EXTERNAL_ONLY");
      expect(window.redirectsExternally).toBe(true);
      expect(applicationWindowAcceptsSubmission(window)).toBe(false);
    }
    for (const method of ["INFORMATION_ONLY", "NOMINATION_REQUIRED"] as const) {
      const window = resolveApplicationWindow({
        ...base,
        applicationMethod: method,
      });
      expect(window.state).toBe("INFORMATION_ONLY");
      expect(applicationWindowAcceptsSubmission(window)).toBe(false);
    }
  });

  it("is deterministic and independent of the client clock", () => {
    const args = {
      ...base,
      applicationDeadline: new Date("2026-09-01T00:00:00.000Z"),
      timezone: "Asia/Shanghai",
    };
    expect(resolveApplicationWindow(args)).toEqual(
      resolveApplicationWindow(args),
    );
    expect(resolveApplicationWindow(args).timezone).toBe("Asia/Shanghai");
  });

  it("refuses submission when the opportunity is not published", () => {
    const window = resolveApplicationWindow({ ...base, lifecycle: "PAUSED" });
    expect(window.state).toBe("CLOSED");
    expect(applicationWindowAcceptsSubmission(window)).toBe(false);
  });
});

describe("eligibility", () => {
  it("produces a positive reason for a matching degree", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({})],
      profile: { studyLevel: "BACHELORS" },
    });
    expect(result.verdict).toBe("LIKELY_ELIGIBLE");
    expect(result.reasons[0].outcome).toBe("MET");
    expect(result.reasons[0].detail).toMatch(/matches/i);
  });

  it("produces a negative reason for an incompatible degree", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({})],
      profile: { studyLevel: "DOCTORATE" },
    });
    expect(result.verdict).toBe("LIKELY_NOT_ELIGIBLE");
    expect(result.reasons[0].outcome).toBe("UNMET");
  });

  it("treats a missing GPA as unknown, never as a rejection", () => {
    const result = evaluateOpportunityEligibility({
      rules: [
        rule({
          id: "r1",
          ruleType: "DEGREE_LEVEL",
          structuredValue: ["BACHELORS"],
        }),
        rule({
          id: "r2",
          ruleType: "GPA",
          operator: "AT_LEAST",
          structuredValue: 3.0,
          publicLabel: "Minimum GPA 3.0",
        }),
      ],
      profile: { studyLevel: "BACHELORS", gpa: null },
    });
    expect(result.verdict).not.toBe("LIKELY_NOT_ELIGIBLE");
    const gpa = result.reasons.find((reason) => reason.ruleId === "r2");
    expect(gpa?.outcome).toBe("UNKNOWN");
    expect(gpa?.detail).toMatch(/add your gpa/i);
  });

  it("returns insufficient information rather than a verdict for an empty profile", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({})],
      profile: {},
    });
    expect(result.verdict).toBe("INSUFFICIENT_PROFILE_INFORMATION");
    expect(result.unmetCount).toBe(0);
  });

  it("gives a signed-out viewer criteria without a personal verdict", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({})],
      profile: null,
    });
    expect(result.verdict).toBe("INSUFFICIENT_PROFILE_INFORMATION");
    expect(result.reasons.every((reason) => reason.outcome === "UNKNOWN")).toBe(
      true,
    );
  });

  it("leaves experience and custom requirements to the provider", () => {
    const result = evaluateOpportunityEligibility({
      rules: [
        rule({
          id: "r3",
          ruleType: "EXPERIENCE",
          operator: "CUSTOM",
          structuredValue: {},
          publicLabel: "Two years of relevant experience",
        }),
      ],
      profile: { studyLevel: "BACHELORS" },
    });
    expect(result.reasons[0].outcome).toBe("UNKNOWN");
    expect(result.reasons[0].detail).toMatch(/provider reviews/i);
  });

  it("always returns explanations and stays advisory", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({}), rule({ id: "r2", required: false })],
      profile: { studyLevel: "BACHELORS" },
    });
    expect(result.advisory).toBe(true);
    expect(result.reasons).toHaveLength(2);
    for (const reason of result.reasons) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.detail.length).toBeGreaterThan(0);
    }
  });

  it("never exposes a numeric eligibility score", () => {
    const result = evaluateOpportunityEligibility({
      rules: [rule({})],
      profile: { studyLevel: "BACHELORS" },
    });
    expect(Object.keys(result)).not.toContain("score");
    expect(Object.keys(result)).not.toContain("eligibilityScore");
  });
});

describe("organization opportunity permissions", () => {
  const editor = { role: "EDITOR", status: "ACTIVE" } as const;
  const viewer = { role: "VIEWER", status: "ACTIVE" } as const;
  const admin = { role: "ADMIN", status: "ACTIVE" } as const;
  const owner = { role: "OWNER", status: "ACTIVE" } as const;

  it("lets an owner manage opportunities and applications", () => {
    expect(
      hasOrganizationPermission(owner, "ORGANIZATION_PUBLISH_OPPORTUNITIES"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(owner, "ORGANIZATION_VIEW_APPLICATIONS"),
    ).toBe(true);
  });

  it("lets an editor author but not read applications", () => {
    expect(
      hasOrganizationPermission(editor, "ORGANIZATION_CREATE_OPPORTUNITIES"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(editor, "ORGANIZATION_SUBMIT_OPPORTUNITIES"),
    ).toBe(true);
    // The central guarantee of §6: authoring never implies applicant access.
    expect(
      hasOrganizationPermission(editor, "ORGANIZATION_VIEW_APPLICATIONS"),
    ).toBe(false);
    expect(
      hasOrganizationPermission(editor, "ORGANIZATION_REVIEW_APPLICATIONS"),
    ).toBe(false);
    expect(
      hasOrganizationPermission(editor, "ORGANIZATION_PUBLISH_OPPORTUNITIES"),
    ).toBe(false);
  });

  it("gives a viewer read-only workspace access and no mutations", () => {
    expect(
      hasOrganizationPermission(viewer, "ORGANIZATION_VIEW_OPPORTUNITIES"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(viewer, "ORGANIZATION_CREATE_OPPORTUNITIES"),
    ).toBe(false);
    expect(
      hasOrganizationPermission(viewer, "ORGANIZATION_VIEW_APPLICATIONS"),
    ).toBe(false);
  });

  it("grants an admin application review", () => {
    expect(
      hasOrganizationPermission(admin, "ORGANIZATION_REVIEW_APPLICATIONS"),
    ).toBe(true);
    expect(
      hasOrganizationPermission(
        admin,
        "ORGANIZATION_CHANGE_APPLICATION_STATUS",
      ),
    ).toBe(true);
  });

  it("removes every permission when the membership is not active", () => {
    expect(
      hasOrganizationPermission(
        { role: "OWNER", status: "REMOVED" },
        "ORGANIZATION_VIEW_OPPORTUNITIES",
      ),
    ).toBe(false);
  });
});
