import type {
  OpportunityEligibilityOperator,
  OpportunityEligibilityRuleType,
  Prisma,
  StudentJourney,
  StudyLevel,
} from "@prisma/client";

/**
 * Advisory, explainable eligibility.
 *
 * There is deliberately no single opaque score. Each rule is evaluated
 * independently into MET / UNMET / UNKNOWN with a human-readable reason, and the
 * overall verdict is derived from those outcomes. Kondo never states legal or
 * official eligibility — the provider decides — and an incomplete Kondo profile
 * produces UNKNOWN, never a rejection.
 *
 * Rules are evaluated entirely on the server against the viewer's own profile.
 * The result is personal data: it is returned only to that viewer, is never
 * cached in a shared cache, and is never exposed to the publisher.
 */

export type EligibilityOutcome = "MET" | "UNMET" | "UNKNOWN";

export type EligibilityVerdict =
  | "LIKELY_ELIGIBLE"
  | "POSSIBLY_ELIGIBLE"
  | "LIKELY_NOT_ELIGIBLE"
  | "INSUFFICIENT_PROFILE_INFORMATION"
  | "MANUAL_REVIEW_REQUIRED";

export type EligibilityReason = {
  ruleId: string;
  ruleType: OpportunityEligibilityRuleType;
  outcome: EligibilityOutcome;
  required: boolean;
  /** Publisher-authored, already safe for display. */
  label: string;
  /** Why this outcome was reached, phrased for the applicant. */
  detail: string;
};

export type EligibilitySummary = {
  verdict: EligibilityVerdict;
  reasons: readonly EligibilityReason[];
  metCount: number;
  unmetCount: number;
  unknownCount: number;
  /** Always true: the provider makes the final decision. */
  advisory: true;
};

export type EligibilityRuleInput = {
  id: string;
  ruleType: OpportunityEligibilityRuleType;
  operator: OpportunityEligibilityOperator;
  structuredValue: Prisma.JsonValue;
  required: boolean;
  publicLabel: string;
};

/**
 * The subset of the viewer's profile eligibility may read. Assembled by the
 * caller so this module never touches the database and can be unit-tested
 * exhaustively.
 */
export type EligibilityProfile = {
  journey?: StudentJourney | null;
  studyLevel?: StudyLevel | null;
  universityId?: string | null;
  fieldOfStudy?: string | null;
  graduationYear?: number | null;
  countryId?: string | null;
  /** Country of nationality, only used where the rule is a genuine requirement. */
  nationalityCountryId?: string | null;
  residenceCountryId?: string | null;
  languages?: readonly string[] | null;
  skills?: readonly string[] | null;
  gpa?: number | null;
  age?: number | null;
  enrolled?: boolean | null;
  availableFrom?: Date | null;
};

function asStringArray(value: Prisma.JsonValue): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") return [value];
  return null;
}

function asNumber(value: Prisma.JsonValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object" && value && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const inner = record.value ?? record.min ?? record.threshold;
    if (typeof inner === "number" && Number.isFinite(inner)) return inner;
  }
  return null;
}

function asRange(value: Prisma.JsonValue): { min: number; max: number } | null {
  if (typeof value === "object" && value && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (typeof record.min === "number" && typeof record.max === "number") {
      return { min: record.min, max: record.max };
    }
  }
  return null;
}

/** Profile field a rule type reads, and the label used when it is missing. */
const RULE_FIELD_LABEL: Record<OpportunityEligibilityRuleType, string> = {
  ACCOUNT_JOURNEY: "your account type",
  STUDENT_STATUS: "your student status",
  DEGREE_LEVEL: "your degree level",
  UNIVERSITY: "your university",
  FIELD_OF_STUDY: "your field of study",
  GRADUATION_YEAR: "your graduation year",
  COUNTRY: "your country",
  NATIONALITY: "your nationality",
  RESIDENCE: "your country of residence",
  AGE: "your date of birth",
  GPA: "your GPA",
  LANGUAGE: "your language proficiency",
  EXPERIENCE: "your experience",
  SKILL: "your listed skills",
  AVAILABILITY: "your availability",
  ENROLLMENT_STATUS: "your enrolment status",
  CUSTOM: "the required information",
};

function compareMembership(
  actual: string | null | undefined,
  expected: string[] | null,
  operator: OpportunityEligibilityOperator,
): EligibilityOutcome {
  if (actual === null || actual === undefined || actual === "")
    return "UNKNOWN";
  if (!expected || expected.length === 0) return "UNKNOWN";
  const contains = expected.some(
    (entry) => entry.toLowerCase() === actual.toLowerCase(),
  );
  if (operator === "NOT_EQUALS" || operator === "NOT_IN") {
    return contains ? "UNMET" : "MET";
  }
  return contains ? "MET" : "UNMET";
}

function compareNumeric(
  actual: number | null | undefined,
  rule: EligibilityRuleInput,
): EligibilityOutcome {
  if (actual === null || actual === undefined) return "UNKNOWN";
  if (rule.operator === "BETWEEN") {
    const range = asRange(rule.structuredValue);
    if (!range) return "UNKNOWN";
    return actual >= range.min && actual <= range.max ? "MET" : "UNMET";
  }
  const threshold = asNumber(rule.structuredValue);
  if (threshold === null) return "UNKNOWN";
  if (rule.operator === "AT_LEAST")
    return actual >= threshold ? "MET" : "UNMET";
  if (rule.operator === "AT_MOST") return actual <= threshold ? "MET" : "UNMET";
  if (rule.operator === "EQUALS") return actual === threshold ? "MET" : "UNMET";
  if (rule.operator === "NOT_EQUALS") {
    return actual === threshold ? "UNMET" : "MET";
  }
  return "UNKNOWN";
}

function compareList(
  actual: readonly string[] | null | undefined,
  expected: string[] | null,
  operator: OpportunityEligibilityOperator,
): EligibilityOutcome {
  if (!actual || actual.length === 0) return "UNKNOWN";
  if (!expected || expected.length === 0) return "UNKNOWN";
  const lower = actual.map((entry) => entry.toLowerCase());
  const contains = expected.some((entry) =>
    lower.includes(entry.toLowerCase()),
  );
  if (operator === "NOT_IN" || operator === "NOT_EQUALS") {
    return contains ? "UNMET" : "MET";
  }
  return contains ? "MET" : "UNMET";
}

function evaluateRule(
  rule: EligibilityRuleInput,
  profile: EligibilityProfile,
): EligibilityOutcome {
  const expected = asStringArray(rule.structuredValue);

  switch (rule.ruleType) {
    case "ACCOUNT_JOURNEY":
      return compareMembership(profile.journey, expected, rule.operator);
    case "DEGREE_LEVEL":
      return compareMembership(profile.studyLevel, expected, rule.operator);
    case "UNIVERSITY":
      return compareMembership(profile.universityId, expected, rule.operator);
    case "FIELD_OF_STUDY":
      return compareMembership(profile.fieldOfStudy, expected, rule.operator);
    case "COUNTRY":
      return compareMembership(profile.countryId, expected, rule.operator);
    case "NATIONALITY":
      return compareMembership(
        profile.nationalityCountryId,
        expected,
        rule.operator,
      );
    case "RESIDENCE":
      return compareMembership(
        profile.residenceCountryId,
        expected,
        rule.operator,
      );
    case "LANGUAGE":
      return compareList(profile.languages, expected, rule.operator);
    case "SKILL":
      return compareList(profile.skills, expected, rule.operator);
    case "GRADUATION_YEAR":
      return compareNumeric(profile.graduationYear, rule);
    case "GPA":
      return compareNumeric(profile.gpa, rule);
    case "AGE":
      return compareNumeric(profile.age, rule);
    case "ENROLLMENT_STATUS":
    case "STUDENT_STATUS": {
      if (profile.enrolled === null || profile.enrolled === undefined) {
        return "UNKNOWN";
      }
      return profile.enrolled ? "MET" : "UNMET";
    }
    case "AVAILABILITY": {
      if (!profile.availableFrom) return "UNKNOWN";
      return "UNKNOWN";
    }
    // Experience and custom requirements are judged by the provider. They are
    // surfaced to the applicant as things to confirm, never auto-failed.
    case "EXPERIENCE":
    case "CUSTOM":
      return "UNKNOWN";
  }
}

function reasonDetail(
  rule: EligibilityRuleInput,
  outcome: EligibilityOutcome,
): string {
  if (outcome === "MET") return "Your profile matches this requirement.";
  if (outcome === "UNMET") {
    return "Your profile does not appear to match this requirement.";
  }
  if (rule.ruleType === "EXPERIENCE" || rule.ruleType === "CUSTOM") {
    return "The provider reviews this requirement manually.";
  }
  return `Add ${RULE_FIELD_LABEL[rule.ruleType]} to your profile to check this.`;
}

export function evaluateOpportunityEligibility(input: {
  rules: readonly EligibilityRuleInput[];
  profile: EligibilityProfile | null;
}): EligibilitySummary {
  // A signed-out visitor gets the criteria without a personal verdict.
  if (!input.profile || input.rules.length === 0) {
    return {
      verdict:
        input.rules.length === 0
          ? "MANUAL_REVIEW_REQUIRED"
          : "INSUFFICIENT_PROFILE_INFORMATION",
      reasons: input.rules.map((rule) => ({
        ruleId: rule.id,
        ruleType: rule.ruleType,
        outcome: "UNKNOWN" as const,
        required: rule.required,
        label: rule.publicLabel,
        detail: reasonDetail(rule, "UNKNOWN"),
      })),
      metCount: 0,
      unmetCount: 0,
      unknownCount: input.rules.length,
      advisory: true,
    };
  }

  const profile = input.profile;
  const reasons = input.rules.map((rule) => {
    const outcome = evaluateRule(rule, profile);
    return {
      ruleId: rule.id,
      ruleType: rule.ruleType,
      outcome,
      required: rule.required,
      label: rule.publicLabel,
      detail: reasonDetail(rule, outcome),
    } satisfies EligibilityReason;
  });

  const metCount = reasons.filter((r) => r.outcome === "MET").length;
  const unmetCount = reasons.filter((r) => r.outcome === "UNMET").length;
  const unknownCount = reasons.filter((r) => r.outcome === "UNKNOWN").length;

  const requiredUnmet = reasons.some(
    (r) => r.required && r.outcome === "UNMET",
  );
  const requiredUnknown = reasons.some(
    (r) => r.required && r.outcome === "UNKNOWN",
  );

  let verdict: EligibilityVerdict;
  if (requiredUnmet) {
    verdict = "LIKELY_NOT_ELIGIBLE";
  } else if (requiredUnknown) {
    // Missing profile information never becomes a rejection.
    verdict =
      metCount > 0 ? "POSSIBLY_ELIGIBLE" : "INSUFFICIENT_PROFILE_INFORMATION";
  } else if (unmetCount > 0 || unknownCount > 0) {
    verdict = "POSSIBLY_ELIGIBLE";
  } else {
    verdict = "LIKELY_ELIGIBLE";
  }

  return {
    verdict,
    reasons,
    metCount,
    unmetCount,
    unknownCount,
    advisory: true,
  };
}

export function eligibilityVerdictLabel(verdict: EligibilityVerdict) {
  const labels: Record<EligibilityVerdict, string> = {
    LIKELY_ELIGIBLE: "Likely eligible",
    POSSIBLY_ELIGIBLE: "Possibly eligible",
    LIKELY_NOT_ELIGIBLE: "Likely not eligible",
    INSUFFICIENT_PROFILE_INFORMATION: "Add more profile information",
    MANUAL_REVIEW_REQUIRED: "Reviewed by the provider",
  };
  return labels[verdict];
}

/**
 * A negative advisory verdict never blocks an application: the applicant may
 * continue wherever the publisher permits it.
 */
export const ELIGIBILITY_DISCLAIMER =
  "This is guidance based on your Kondo profile. The provider makes the final decision.";
