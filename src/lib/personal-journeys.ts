import type { StudentJourney } from "@prisma/client";

export const NEW_PERSONAL_JOURNEYS = [
  "PROSPECTIVE_STUDENT",
  "ADMITTED_STUDENT",
  "CURRENT_STUDENT",
  "ALUMNI",
  "PROFESSIONAL",
] as const satisfies readonly StudentJourney[];

export type NewPersonalJourney = (typeof NEW_PERSONAL_JOURNEYS)[number];

export const PERSONAL_JOURNEY_PRESENTATION: Record<
  NewPersonalJourney,
  { label: string; description: string; icon: string }
> = {
  PROSPECTIVE_STUDENT: {
    label: "Prospective student",
    description: "I am exploring or preparing to study in China.",
    icon: "🧭",
  },
  ADMITTED_STUDENT: {
    label: "Admitted student",
    description: "I have received admission and am preparing to arrive.",
    icon: "✈️",
  },
  CURRENT_STUDENT: {
    label: "Current student",
    description: "I currently study in China.",
    icon: "🎓",
  },
  ALUMNI: {
    label: "Alumni",
    description: "I previously studied in China.",
    icon: "🌱",
  },
  PROFESSIONAL: {
    label: "Professional",
    description: "I live, work or build professional connections with China.",
    icon: "💼",
  },
};

export function personalJourneyLabel(
  journey: StudentJourney | string | null | undefined,
) {
  if (journey === "INCOMING_STUDENT") return "Incoming student";
  if (journey && journey in PERSONAL_JOURNEY_PRESENTATION) {
    return PERSONAL_JOURNEY_PRESENTATION[journey as NewPersonalJourney].label;
  }
  return "Kondo member";
}

export function studentHubAccessForJourney(
  journey: StudentJourney | string | null | undefined,
) {
  const fullAcademicTools =
    journey === "CURRENT_STUDENT" ||
    journey === "ADMITTED_STUDENT" ||
    journey === "INCOMING_STUDENT";
  return {
    guides: true,
    scholarships: true,
    opportunities: true,
    internships: true,
    academicTools: fullAcademicTools,
  };
}

export function journeyNeedsStudyAffiliation(
  journey: StudentJourney | string | null | undefined,
) {
  return (
    journey === "CURRENT_STUDENT" ||
    journey === "ADMITTED_STUDENT" ||
    journey === "INCOMING_STUDENT"
  );
}
