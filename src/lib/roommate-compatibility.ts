import type {
  HousingListingType,
  HousingPolicyPreference,
} from "@prisma/client";

/**
 * Centralized roommate eligibility and compatibility rules.
 *
 * Every criterion below already exists on `RoommateProfile` and is already
 * collected from members — nothing here introduces a new preference, field or
 * questionnaire step. The rules were previously spread between a Prisma `where`
 * clause and a display-only `compatibilityReasons()` helper, which is how the
 * two drifted apart: the query and the explanation disagreed about what a match
 * even was.
 *
 * Two deliberately separate concepts:
 *
 *  - ELIGIBILITY decides whether a candidate may be shown at all. Failing one
 *    rule removes the candidate; there is no partial credit.
 *  - SCORING ranks the candidates that passed. It never removes anyone.
 *
 * `genderPreference` and the member's own `gender` are read by the product for
 * other purposes but are deliberately excluded from scoring: ranking people by
 * a protected attribute is not something Kondo does.
 */

export type CompatibilityProfile = {
  id: string;
  userId: string;
  status: string;
  visibility: string;
  allowInterests: boolean;
  expiresAt: Date | null;
  moveInDate: Date;
  stayDurationMonths: number | null;
  budgetMinimumMinor: number | null;
  budgetMaximumMinor: number;
  currency: string;
  preferredHousingTypes: HousingListingType[];
  languages: string[];
  sleepSchedule: string | null;
  routine: string | null;
  cleanlinessPreference: string | null;
  cookingFrequency: string | null;
  smokingPreference: HousingPolicyPreference;
  petPreference: HousingPolicyPreference;
  guestPreference: string | null;
  noisePreference: string | null;
  city: { id: string; name: string } | null;
  university: { id: string; name: string } | null;
  user: { id: string; status: string };
};

/** How far apart two move-in dates may be and still count as compatible. */
export const MOVE_IN_TOLERANCE_DAYS = 45;
/** Closer than this reads as "the same timing" in the explanation. */
const MOVE_IN_CLOSE_DAYS = 14;
const DAY_MS = 86_400_000;

export type EligibilityKey =
  | "self"
  | "active-profile"
  | "visible-profile"
  | "not-expired"
  | "active-user"
  | "blocked"
  | "city"
  | "move-in"
  | "budget";

export type EligibilityFailure = {
  key: EligibilityKey;
  /** Shown in aggregate on the empty state; never names another member. */
  summary: string;
};

/**
 * A NULL minimum budget means "no lower bound", not "unknown".
 *
 * The roommate form only collects a maximum, so `budgetMinimumMinor` is NULL on
 * essentially every profile created through the UI. Treating NULL as a value to
 * compare against silently excluded those profiles from every budget-filtered
 * search — which is the bug behind "two compatible profiles and neither
 * appears".
 */
export function budgetFloor(profile: {
  budgetMinimumMinor: number | null;
}): number {
  return profile.budgetMinimumMinor ?? 0;
}

export function budgetsOverlap(
  first: { budgetMinimumMinor: number | null; budgetMaximumMinor: number },
  second: { budgetMinimumMinor: number | null; budgetMaximumMinor: number },
) {
  return (
    first.budgetMaximumMinor >= budgetFloor(second) &&
    second.budgetMaximumMinor >= budgetFloor(first)
  );
}

export function daysBetween(first: Date, second: Date) {
  return Math.abs(first.getTime() - second.getTime()) / DAY_MS;
}

/**
 * Required criteria. Returns the first failure, or null when the candidate is
 * eligible. Order matters only for which reason is reported, not for the
 * outcome.
 */
export function roommateEligibility(input: {
  viewer: CompatibilityProfile | null;
  candidate: CompatibilityProfile;
  blocked: boolean;
  now: Date;
}): EligibilityFailure | null {
  const { viewer, candidate, blocked, now } = input;

  if (viewer && candidate.userId === viewer.userId) {
    return { key: "self", summary: "Your own profile is never listed." };
  }
  if (blocked) {
    return { key: "blocked", summary: "Some profiles are unavailable to you." };
  }
  if (candidate.status !== "ACTIVE") {
    return {
      key: "active-profile",
      summary: "Some profiles are paused or not activated.",
    };
  }
  if (candidate.visibility !== "MEMBERS_ONLY") {
    return {
      key: "visible-profile",
      summary: "Some profiles are set to private.",
    };
  }
  if (candidate.expiresAt && candidate.expiresAt <= now) {
    return { key: "not-expired", summary: "Some profiles have expired." };
  }
  if (candidate.user.status !== "ACTIVE") {
    return {
      key: "active-user",
      summary: "Some members are no longer active on Kondo.",
    };
  }

  // Without a profile of their own a member simply browses: nothing to compare
  // against, so no viewer-relative rule can fail.
  if (!viewer) return null;

  if (viewer.city?.id && candidate.city?.id !== viewer.city.id) {
    return {
      key: "city",
      summary: "Some profiles are searching in a different city.",
    };
  }
  if (
    daysBetween(viewer.moveInDate, candidate.moveInDate) >
    MOVE_IN_TOLERANCE_DAYS
  ) {
    return {
      key: "move-in",
      summary: "Some profiles are moving in at a very different time.",
    };
  }
  // Budgets in different currencies are not comparable, so they are not a
  // reason to exclude anyone.
  if (
    viewer.currency === candidate.currency &&
    !budgetsOverlap(viewer, candidate)
  ) {
    return {
      key: "budget",
      summary: "Some profiles have budgets that do not overlap with yours.",
    };
  }
  return null;
}

export type ScoringCriterionKey =
  | "city"
  | "university"
  | "move-in"
  | "budget"
  | "stay-duration"
  | "housing-type"
  | "languages"
  | "cleanliness"
  | "sleep-schedule"
  | "routine"
  | "cooking"
  | "smoking"
  | "pets"
  | "guests"
  | "noise";

export type ScoredCriterion = {
  key: ScoringCriterionKey;
  weight: number;
  /** Shown to the member, e.g. "Same university". */
  label: string;
};

type CriterionDefinition = {
  key: ScoringCriterionKey;
  weight: number;
  label: string;
  /**
   * `null` means the criterion does not apply to this pair (one side left the
   * preference unset), so it counts neither for nor against the score.
   */
  evaluate: (
    viewer: CompatibilityProfile,
    candidate: CompatibilityProfile,
  ) => { matched: boolean; label?: string } | null;
};

function sharedValues(first: string[], second: string[]) {
  const set = new Set(first.map((value) => value.trim().toLowerCase()));
  return second.filter((value) => set.has(value.trim().toLowerCase()));
}

/** Compares an optional free-text preference only when both sides answered. */
function bothAnswered(
  first: string | null,
  second: string | null,
): { matched: boolean } | null {
  if (!first || !second) return null;
  return {
    matched: first.trim().toLowerCase() === second.trim().toLowerCase(),
  };
}

function policyAgreement(
  first: HousingPolicyPreference,
  second: HousingPolicyPreference,
): { matched: boolean } | null {
  if (first === "NOT_SPECIFIED" || second === "NOT_SPECIFIED") return null;
  return { matched: first === second };
}

export const ROOMMATE_SCORING_CRITERIA: readonly CriterionDefinition[] = [
  {
    key: "city",
    weight: 12,
    label: "Same city",
    evaluate: (viewer, candidate) =>
      viewer.city?.id && candidate.city?.id
        ? { matched: viewer.city.id === candidate.city.id }
        : null,
  },
  {
    key: "university",
    weight: 10,
    label: "Same university",
    evaluate: (viewer, candidate) =>
      viewer.university?.id && candidate.university?.id
        ? { matched: viewer.university.id === candidate.university.id }
        : null,
  },
  {
    key: "move-in",
    weight: 12,
    label: "Matching move-in date",
    evaluate: (viewer, candidate) => ({
      matched:
        daysBetween(viewer.moveInDate, candidate.moveInDate) <=
        MOVE_IN_CLOSE_DAYS,
    }),
  },
  {
    key: "budget",
    weight: 12,
    label: "Similar budget",
    evaluate: (viewer, candidate) =>
      viewer.currency === candidate.currency
        ? { matched: budgetsOverlap(viewer, candidate) }
        : null,
  },
  {
    key: "stay-duration",
    weight: 6,
    label: "Similar stay length",
    evaluate: (viewer, candidate) =>
      viewer.stayDurationMonths && candidate.stayDurationMonths
        ? {
            matched:
              Math.abs(
                viewer.stayDurationMonths - candidate.stayDurationMonths,
              ) <= 3,
          }
        : null,
  },
  {
    key: "housing-type",
    weight: 8,
    label: "Same housing preference",
    evaluate: (viewer, candidate) =>
      viewer.preferredHousingTypes.length &&
      candidate.preferredHousingTypes.length
        ? {
            matched:
              sharedValues(
                viewer.preferredHousingTypes,
                candidate.preferredHousingTypes,
              ).length > 0,
          }
        : null,
  },
  {
    key: "languages",
    weight: 10,
    label: "Shared language",
    evaluate: (viewer, candidate) => {
      if (!viewer.languages.length || !candidate.languages.length) return null;
      const shared = sharedValues(viewer.languages, candidate.languages);
      return shared.length
        ? { matched: true, label: `Shared language: ${shared[0]}` }
        : { matched: false };
    },
  },
  {
    key: "cleanliness",
    weight: 8,
    label: "Similar cleanliness",
    evaluate: (viewer, candidate) =>
      bothAnswered(
        viewer.cleanlinessPreference,
        candidate.cleanlinessPreference,
      ),
  },
  {
    key: "sleep-schedule",
    weight: 8,
    label: "Similar sleep schedule",
    evaluate: (viewer, candidate) =>
      bothAnswered(viewer.sleepSchedule, candidate.sleepSchedule),
  },
  {
    key: "routine",
    weight: 5,
    label: "Similar daily routine",
    evaluate: (viewer, candidate) =>
      bothAnswered(viewer.routine, candidate.routine),
  },
  {
    key: "cooking",
    weight: 4,
    label: "Similar cooking habits",
    evaluate: (viewer, candidate) =>
      bothAnswered(viewer.cookingFrequency, candidate.cookingFrequency),
  },
  {
    key: "smoking",
    weight: 8,
    label: "Compatible smoking preference",
    evaluate: (viewer, candidate) =>
      policyAgreement(viewer.smokingPreference, candidate.smokingPreference),
  },
  {
    key: "pets",
    weight: 5,
    label: "Compatible pet preference",
    evaluate: (viewer, candidate) =>
      policyAgreement(viewer.petPreference, candidate.petPreference),
  },
  {
    key: "guests",
    weight: 4,
    label: "Similar guest preference",
    evaluate: (viewer, candidate) =>
      bothAnswered(viewer.guestPreference, candidate.guestPreference),
  },
  {
    key: "noise",
    weight: 4,
    label: "Similar noise preference",
    evaluate: (viewer, candidate) =>
      bothAnswered(viewer.noisePreference, candidate.noisePreference),
  },
];

export type CompatibilityResult = {
  /** 0–100. Percentage of the weight that actually applied to this pair. */
  score: number;
  matched: ScoredCriterion[];
  excluded: ScoredCriterion[];
  /** Criteria neither side answered; reported so the UI can invite completion. */
  notComparable: ScoringCriterionKey[];
  explanation: string;
};

function humanList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}

/**
 * Deterministic compatibility score for one eligible pair.
 *
 * The score is the share of *applicable* weight that matched, so a pair who
 * both answered few questions is not punished for the questions neither of them
 * answered — they simply have less evidence, which the explanation states.
 */
export function roommateCompatibility(
  viewer: CompatibilityProfile | null,
  candidate: CompatibilityProfile,
): CompatibilityResult {
  if (!viewer) {
    return {
      score: 0,
      matched: [],
      excluded: [],
      notComparable: ROOMMATE_SCORING_CRITERIA.map(({ key }) => key),
      explanation:
        "Create your roommate profile to see how well you match with this person.",
    };
  }

  const matched: ScoredCriterion[] = [];
  const excluded: ScoredCriterion[] = [];
  const notComparable: ScoringCriterionKey[] = [];
  let applicableWeight = 0;
  let matchedWeight = 0;

  for (const criterion of ROOMMATE_SCORING_CRITERIA) {
    const outcome = criterion.evaluate(viewer, candidate);
    if (!outcome) {
      notComparable.push(criterion.key);
      continue;
    }
    applicableWeight += criterion.weight;
    const entry: ScoredCriterion = {
      key: criterion.key,
      weight: criterion.weight,
      label: outcome.label ?? criterion.label,
    };
    if (outcome.matched) {
      matchedWeight += criterion.weight;
      matched.push(entry);
    } else {
      excluded.push(entry);
    }
  }

  const score = applicableWeight
    ? Math.round((matchedWeight / applicableWeight) * 100)
    : 0;

  const highlights = [...matched]
    // Heaviest criteria first, then alphabetical, so the sentence is stable.
    .sort(
      (first, second) =>
        second.weight - first.weight || first.key.localeCompare(second.key),
    )
    .slice(0, 4)
    .map((entry) => entry.label.toLowerCase());

  const explanation = matched.length
    ? `${score}% compatible — ${humanList(highlights)}${
        matched.length > highlights.length
          ? `, and ${matched.length - highlights.length} more shared preference${
              matched.length - highlights.length === 1 ? "" : "s"
            }`
          : ""
      }.`
    : `${score}% compatible — no shared living preferences yet.`;

  return { score, matched, excluded, notComparable, explanation };
}

/**
 * Truthful empty state. Reports why candidates were removed, in aggregate,
 * without ever naming a member or revealing a specific profile's data.
 */
export function describeRoommateExclusions(
  failures: readonly EligibilityFailure[],
) {
  if (!failures.length) {
    return "No compatible profiles found yet. New roommate profiles appear here as members activate them.";
  }
  const summaries = [...new Set(failures.map((failure) => failure.summary))]
    .filter((summary) => !summary.startsWith("Your own"))
    .slice(0, 3);
  if (!summaries.length) {
    return "No compatible profiles found yet.";
  }
  return `No compatible profiles found. ${summaries.join(" ")}`;
}
