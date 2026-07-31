import type {
  OpportunityApplicationMethod,
  OpportunityPublisherType,
  OpportunityType,
  OrganizationCapabilityKey,
} from "@prisma/client";

/**
 * Centralized opportunity-type registry.
 *
 * Every label, category, capability requirement and indexing decision for an
 * opportunity type is declared exactly once here. Components read from this
 * registry instead of restating labels, so a new type cannot ship with a
 * different name in search, the public page and the workspace.
 */

export const OPPORTUNITY_CATEGORIES = [
  "scholarships",
  "internships",
  "jobs",
  "research",
  "programs",
  "volunteering",
] as const;

export type OpportunityCategory = (typeof OPPORTUNITY_CATEGORIES)[number];

export type OpportunityTypeDefinition = {
  key: OpportunityType;
  label: string;
  pluralLabel: string;
  description: string;
  icon: string;
  category: OpportunityCategory;
  /** Detail table a record of this type is expected to carry, if any. */
  detail: "scholarship" | "job" | null;
  supportedPublisherTypes: readonly OpportunityPublisherType[];
  allowedApplicationMethods: readonly OpportunityApplicationMethod[];
  organizationCapability: OrganizationCapabilityKey;
  /** Student Hub rail this type feeds. */
  studentHubSection: string;
  /** Whether a published record of this type may be indexed by search engines. */
  indexable: boolean;
  analyticsKey: string;
};

const ALL_PUBLISHERS = [
  "ORGANIZATION",
  "EDITORIAL",
  "LEGACY_SCHOLARSHIP_AGENT",
] as const satisfies readonly OpportunityPublisherType[];

const ORGANIZATION_OR_EDITORIAL = [
  "ORGANIZATION",
  "EDITORIAL",
] as const satisfies readonly OpportunityPublisherType[];

const EVERY_METHOD = [
  "KONDO_APPLICATION",
  "EXTERNAL_URL",
  "EMAIL",
  "INFORMATION_ONLY",
  "NOMINATION_REQUIRED",
] as const satisfies readonly OpportunityApplicationMethod[];

// Scholarships are frequently nomination-based and very often live on an
// official external portal, so every method stays available. Jobs never use
// NOMINATION_REQUIRED.
const EMPLOYMENT_METHODS = [
  "KONDO_APPLICATION",
  "EXTERNAL_URL",
  "EMAIL",
  "INFORMATION_ONLY",
] as const satisfies readonly OpportunityApplicationMethod[];

export const OPPORTUNITY_TYPES = [
  {
    key: "SCHOLARSHIP",
    label: "Scholarship",
    pluralLabel: "Scholarships",
    description: "Funding towards tuition, living costs or both.",
    icon: "graduation-cap",
    category: "scholarships",
    detail: "scholarship",
    supportedPublisherTypes: ALL_PUBLISHERS,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "SCHOLARSHIPS",
    studentHubSection: "scholarships",
    indexable: true,
    analyticsKey: "scholarship",
  },
  {
    key: "INTERNSHIP",
    label: "Internship",
    pluralLabel: "Internships",
    description: "Practical experience for students still studying.",
    icon: "briefcase",
    category: "internships",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "internships",
    indexable: true,
    analyticsKey: "internship",
  },
  {
    key: "GRADUATE_INTERNSHIP",
    label: "Graduate internship",
    pluralLabel: "Graduate internships",
    description: "Structured experience for recent graduates.",
    icon: "briefcase",
    category: "internships",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "internships",
    indexable: true,
    analyticsKey: "graduate_internship",
  },
  {
    key: "PART_TIME_JOB",
    label: "Part-time job",
    pluralLabel: "Part-time jobs",
    description: "Paid work alongside study.",
    icon: "clock",
    category: "jobs",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "jobs",
    indexable: true,
    analyticsKey: "part_time_job",
  },
  {
    key: "FULL_TIME_JOB",
    label: "Full-time job",
    pluralLabel: "Full-time jobs",
    description: "Entry-level and early-career positions.",
    icon: "briefcase",
    category: "jobs",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "jobs",
    indexable: true,
    analyticsKey: "full_time_job",
  },
  {
    key: "CAMPUS_JOB",
    label: "Campus job",
    pluralLabel: "Campus jobs",
    description: "Work offered on or through a university campus.",
    icon: "building",
    category: "jobs",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "jobs",
    indexable: true,
    analyticsKey: "campus_job",
  },
  {
    key: "RESEARCH_OPPORTUNITY",
    label: "Research opportunity",
    pluralLabel: "Research opportunities",
    description: "Assistantships, laboratory placements and research projects.",
    icon: "flask",
    category: "research",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "research",
    indexable: true,
    analyticsKey: "research_opportunity",
  },
  {
    key: "VOLUNTEERING",
    label: "Volunteering",
    pluralLabel: "Volunteering",
    description: "Unpaid community and student-association activity.",
    icon: "heart",
    category: "volunteering",
    detail: "job",
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EMPLOYMENT_METHODS,
    organizationCapability: "INTERNSHIPS_JOBS",
    studentHubSection: "volunteering",
    indexable: true,
    analyticsKey: "volunteering",
  },
  {
    key: "COMPETITION",
    label: "Competition",
    pluralLabel: "Competitions",
    description: "Contests, hackathons and challenge programs.",
    icon: "trophy",
    category: "programs",
    detail: null,
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "EVENTS",
    studentHubSection: "programs",
    indexable: true,
    analyticsKey: "competition",
  },
  {
    key: "EXCHANGE_PROGRAM",
    label: "Exchange program",
    pluralLabel: "Exchange programs",
    description: "Study or cultural exchange between institutions.",
    icon: "globe",
    category: "programs",
    detail: null,
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "UNIVERSITY_INFORMATION",
    studentHubSection: "programs",
    indexable: true,
    analyticsKey: "exchange_program",
  },
  {
    key: "SUMMER_PROGRAM",
    label: "Summer program",
    pluralLabel: "Summer programs",
    description: "Short seasonal academic or language programs.",
    icon: "sun",
    category: "programs",
    detail: null,
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "UNIVERSITY_INFORMATION",
    studentHubSection: "programs",
    indexable: true,
    analyticsKey: "summer_program",
  },
  {
    key: "OTHER_PROGRAM",
    label: "Program",
    pluralLabel: "Programs",
    description: "Another structured opportunity for students.",
    icon: "sparkles",
    category: "programs",
    detail: null,
    supportedPublisherTypes: ORGANIZATION_OR_EDITORIAL,
    allowedApplicationMethods: EVERY_METHOD,
    organizationCapability: "UNIVERSITY_INFORMATION",
    studentHubSection: "programs",
    indexable: true,
    analyticsKey: "other_program",
  },
] as const satisfies ReadonlyArray<OpportunityTypeDefinition>;

export const OPPORTUNITY_TYPE_KEYS = OPPORTUNITY_TYPES.map(
  ({ key }) => key,
) as [OpportunityType, ...OpportunityType[]];

export function opportunityTypeDefinition(key: OpportunityType) {
  const definition = OPPORTUNITY_TYPES.find((entry) => entry.key === key);
  if (!definition) {
    throw new Error(`Unknown opportunity type: ${key}`);
  }
  return definition;
}

export function opportunityTypeLabel(key: OpportunityType) {
  return opportunityTypeDefinition(key).label;
}

export function isOpportunityType(value: string): value is OpportunityType {
  return OPPORTUNITY_TYPE_KEYS.includes(value as OpportunityType);
}

export function isOpportunityCategory(
  value: string,
): value is OpportunityCategory {
  return OPPORTUNITY_CATEGORIES.includes(value as OpportunityCategory);
}

export function opportunityTypesForCategory(category: OpportunityCategory) {
  return OPPORTUNITY_TYPES.filter((entry) => entry.category === category).map(
    ({ key }) => key,
  );
}

export function opportunityCapabilityFor(key: OpportunityType) {
  return opportunityTypeDefinition(key).organizationCapability;
}

export function opportunitySupportsPublisher(
  key: OpportunityType,
  publisherType: OpportunityPublisherType,
) {
  const supported: readonly OpportunityPublisherType[] =
    opportunityTypeDefinition(key).supportedPublisherTypes;
  return supported.includes(publisherType);
}

export function opportunitySupportsApplicationMethod(
  key: OpportunityType,
  method: OpportunityApplicationMethod,
) {
  const allowed: readonly OpportunityApplicationMethod[] =
    opportunityTypeDefinition(key).allowedApplicationMethods;
  return allowed.includes(method);
}

/**
 * A type change that would move a record between detail tables is structurally
 * incompatible. Once applications exist the change is refused outright rather
 * than silently dropping scholarship funding or job compensation data.
 */
export function canChangeOpportunityType(input: {
  from: OpportunityType;
  to: OpportunityType;
  hasApplications: boolean;
}) {
  if (input.from === input.to) return true;
  const from = opportunityTypeDefinition(input.from);
  const to = opportunityTypeDefinition(input.to);
  if (from.detail !== to.detail) return !input.hasApplications;
  return true;
}
