import type { OpportunityType } from "@prisma/client";
import { OPPORTUNITY_TYPES } from "@/lib/opportunity-types";

/**
 * Student Hub information architecture.
 *
 * The Student Hub presents opportunity discovery in the categories a student
 * actually thinks in. Each section is a *filtered projection* of the central
 * Opportunity domain — there is no separate scholarship, internship or job
 * storage. A section may therefore span several `OPPORTUNITY_CATEGORIES`
 * (Programs & Research covers research, programs and volunteering), which is
 * exactly why this registry exists instead of reusing the category list.
 *
 * The generic "Opportunities" entry was deliberately removed: it duplicated
 * every other entry and made the hub read as two competing navigations.
 */

export type StudentHubSectionKey =
  | "overview"
  | "scholarships"
  | "internships"
  | "jobs"
  | "programs"
  | "competitions"
  | "applications";

export type StudentHubSection = {
  key: StudentHubSectionKey;
  href: string;
  label: string;
  /** Page <h1> and metadata title. Never a generic "Opportunities". */
  title: string;
  description: string;
  /** Opportunity types this section projects. Empty for non-listing sections. */
  types: readonly OpportunityType[];
  /** Copy shown when the filtered projection returns nothing. */
  emptyTitle: string;
  emptyBody: string;
};

const SCHOLARSHIP_TYPES = ["SCHOLARSHIP"] as const;
const INTERNSHIP_TYPES = ["INTERNSHIP", "GRADUATE_INTERNSHIP"] as const;
const JOB_TYPES = ["PART_TIME_JOB", "FULL_TIME_JOB", "CAMPUS_JOB"] as const;
const PROGRAM_TYPES = [
  "RESEARCH_OPPORTUNITY",
  "VOLUNTEERING",
  "EXCHANGE_PROGRAM",
  "SUMMER_PROGRAM",
  "OTHER_PROGRAM",
] as const;
const COMPETITION_TYPES = ["COMPETITION"] as const;

export const STUDENT_HUB_SECTIONS = [
  {
    key: "overview",
    href: "/student-hub",
    label: "Overview",
    title: "Student Hub",
    description:
      "Guides, opportunities and the applications that need you next.",
    types: [],
    emptyTitle: "Nothing to show yet",
    emptyBody: "Published opportunities will appear here as they open.",
  },
  {
    key: "scholarships",
    href: "/student-hub/scholarships",
    label: "Scholarships",
    title: "Scholarships",
    description:
      "Funding towards tuition, living costs or both, from every publisher on Kondo.",
    types: SCHOLARSHIP_TYPES,
    emptyTitle: "No scholarship matches these filters",
    emptyBody:
      "No matching public scholarship is available right now. Try a broader destination, level or funding type.",
  },
  {
    key: "internships",
    href: "/student-hub/internships",
    label: "Internships",
    title: "Internships",
    description:
      "Practical experience while you study, and structured programmes for recent graduates.",
    types: INTERNSHIP_TYPES,
    emptyTitle: "No internship matches these filters",
    emptyBody:
      "No matching internship is available right now. Try changing the location, work mode or field.",
  },
  {
    key: "jobs",
    href: "/student-hub/jobs",
    label: "Jobs",
    title: "Jobs",
    description:
      "Part-time work alongside study, campus roles and early-career positions.",
    types: JOB_TYPES,
    emptyTitle: "No job matches these filters",
    emptyBody:
      "No matching job is available right now. Try changing the location or work mode.",
  },
  {
    key: "programs",
    href: "/student-hub/programs",
    label: "Programs & Research",
    title: "Programs & Research",
    description:
      "Research placements, exchanges, summer programmes, competitions and volunteering.",
    types: PROGRAM_TYPES,
    emptyTitle: "No programme matches these filters",
    emptyBody:
      "No matching programme or research opportunity is available right now. Try a broader search.",
  },
  {
    key: "competitions",
    href: "/student-hub/competitions",
    label: "Competitions",
    title: "Competitions",
    description:
      "Contests, hackathons and challenge programmes open to students.",
    types: COMPETITION_TYPES,
    emptyTitle: "No competition matches these filters",
    emptyBody:
      "No matching competition is open right now. Try a broader search.",
  },
  {
    key: "applications",
    href: "/student-hub/applications",
    label: "Applications",
    title: "Your applications",
    description:
      "Every application you have started or submitted, and what each one needs next.",
    types: [],
    emptyTitle: "No applications yet",
    emptyBody:
      "Applications you start on Kondo appear here with their status and next step.",
  },
] as const satisfies ReadonlyArray<StudentHubSection>;

export const STUDENT_HUB_SECTION_KEYS = STUDENT_HUB_SECTIONS.map(
  ({ key }) => key,
);

export function studentHubSection(key: StudentHubSectionKey) {
  const section = STUDENT_HUB_SECTIONS.find((entry) => entry.key === key);
  if (!section) throw new Error(`Unknown Student Hub section: ${key}`);
  return section;
}

/** Opportunity types a section projects, as a mutable array for Prisma filters. */
export function studentHubSectionTypes(
  key: StudentHubSectionKey,
): OpportunityType[] {
  return [...studentHubSection(key).types];
}

/**
 * Guards the mapping against a type added to the registry but never surfaced.
 * Every opportunity type must be reachable from exactly one hub section, or a
 * publisher could create a record no student can ever browse to.
 */
export function unmappedOpportunityTypes(): OpportunityType[] {
  const mapped = new Set<string>(
    STUDENT_HUB_SECTIONS.flatMap((section) => [...section.types]),
  );
  return OPPORTUNITY_TYPES.filter(({ key }) => !mapped.has(key)).map(
    ({ key }) => key,
  );
}

/** The hub section a given opportunity type belongs to, if any. */
export function studentHubSectionForType(
  type: OpportunityType,
): StudentHubSection | null {
  return (
    STUDENT_HUB_SECTIONS.find((section) =>
      (section.types as readonly string[]).includes(type),
    ) ?? null
  );
}
