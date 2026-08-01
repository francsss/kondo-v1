import type {
  KondoJourneyGroup,
  KondoJourneyStage,
  ProspectiveApplicationStage,
  StudentJourney,
} from "@prisma/client";

export const JOURNEY_GROUPS = [
  "PREPARING_FOR_CHINA",
  "STUDYING_AND_LIVING_IN_CHINA",
  "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
] as const satisfies readonly KondoJourneyGroup[];

export const JOURNEY_STAGES_BY_GROUP = {
  PREPARING_FOR_CHINA: [
    "EXPLORING",
    "PREPARING_APPLICATION",
    "APPLICATION_SUBMITTED",
    "WAITING_FOR_DECISION",
    "ADMITTED",
    "PREPARING_ARRIVAL",
  ],
  STUDYING_AND_LIVING_IN_CHINA: [
    "NEW_ARRIVAL",
    "CURRENT_STUDENT",
    "INTERNSHIP_PREPARATION",
    "FINAL_YEAR",
  ],
  CAREER_ALUMNI_AND_ENTREPRENEURSHIP: [
    "GRADUATING",
    "JOB_SEEKING",
    "EMPLOYED",
    "ALUMNI",
    "PROFESSIONAL",
    "ENTREPRENEUR",
  ],
} as const satisfies Record<KondoJourneyGroup, readonly KondoJourneyStage[]>;

export const JOURNEY_GROUP_PRESENTATION: Record<
  KondoJourneyGroup,
  { label: string; description: string; icon: string }
> = {
  PREPARING_FOR_CHINA: {
    label: "Preparing for China",
    description: "Explore, apply, receive a decision and prepare your arrival.",
    icon: "🧭",
  },
  STUDYING_AND_LIVING_IN_CHINA: {
    label: "Studying and living in China",
    description: "Settle in, study and prepare for internships or graduation.",
    icon: "🎓",
  },
  CAREER_ALUMNI_AND_ENTREPRENEURSHIP: {
    label: "Career, alumni and entrepreneurship",
    description: "Build your career, support others or grow a venture.",
    icon: "🌱",
  },
};

const sentenceCase = (value: string) => {
  const text = value.toLowerCase().replaceAll("_", " ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

export function journeyStageLabel(stage: KondoJourneyStage) {
  return sentenceCase(stage);
}

export function isJourneyStageInGroup(
  group: KondoJourneyGroup,
  stage: KondoJourneyStage,
) {
  return (
    JOURNEY_STAGES_BY_GROUP[group] as readonly KondoJourneyStage[]
  ).includes(stage);
}

export function legacyJourneyFor(
  group: KondoJourneyGroup,
  stage: KondoJourneyStage,
): StudentJourney {
  if (group === "STUDYING_AND_LIVING_IN_CHINA") return "CURRENT_STUDENT";
  if (group === "CAREER_ALUMNI_AND_ENTREPRENEURSHIP") {
    return stage === "ALUMNI" ? "ALUMNI" : "PROFESSIONAL";
  }
  return stage === "ADMITTED" || stage === "PREPARING_ARRIVAL"
    ? "ADMITTED_STUDENT"
    : "PROSPECTIVE_STUDENT";
}

export function prospectiveStageFor(
  group: KondoJourneyGroup,
  stage: KondoJourneyStage,
): ProspectiveApplicationStage | null {
  if (group !== "PREPARING_FOR_CHINA") return null;
  return stage as ProspectiveApplicationStage;
}

export function inferJourney(input: {
  group?: KondoJourneyGroup | null;
  stage?: KondoJourneyStage | null;
  legacyJourney?: StudentJourney | null;
  applicationStage?: ProspectiveApplicationStage | null;
}): { group: KondoJourneyGroup; stage: KondoJourneyStage } {
  if (
    input.group &&
    input.stage &&
    isJourneyStageInGroup(input.group, input.stage)
  ) {
    return { group: input.group, stage: input.stage };
  }
  if (input.legacyJourney === "CURRENT_STUDENT") {
    return {
      group: "STUDYING_AND_LIVING_IN_CHINA",
      stage: "CURRENT_STUDENT",
    };
  }
  if (input.legacyJourney === "ALUMNI") {
    return {
      group: "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
      stage: "ALUMNI",
    };
  }
  if (input.legacyJourney === "PROFESSIONAL") {
    return {
      group: "CAREER_ALUMNI_AND_ENTREPRENEURSHIP",
      stage: "PROFESSIONAL",
    };
  }
  const stage =
    input.legacyJourney === "ADMITTED_STUDENT"
      ? "ADMITTED"
      : input.applicationStage &&
          input.applicationStage !== "SEARCHING_SCHOLARSHIPS"
        ? input.applicationStage
        : "EXPLORING";
  return { group: "PREPARING_FOR_CHINA", stage };
}
