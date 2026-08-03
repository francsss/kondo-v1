import type { OrganizationType } from "@prisma/client";

/**
 * `sectionPriority` lists the value sections that lead a public profile for
 * this organization type, most important first. A visitor's first question is
 * "what does this organization offer?", so About and background sections are
 * never listed here — they follow the value sections by their own order.
 * Only sections with real published content ever become visible.
 */
export const ORGANIZATION_TYPES = [
  {
    key: "COMPANY",
    label: "Company",
    description: "A company serving students or the wider China ecosystem.",
    sectionPriority: ["products", "jobs", "student-services", "events"],
  },
  {
    key: "UNIVERSITY",
    label: "University",
    description: "A university or higher-education institution.",
    sectionPriority: ["university-information", "scholarships", "events"],
  },
  {
    key: "EDUCATION_AGENCY",
    label: "Education agency",
    description: "An education consultancy or student admissions agency.",
    sectionPriority: ["scholarships", "student-services", "jobs"],
  },
  {
    key: "HOUSING_PROVIDER",
    label: "Housing provider",
    description: "An organization providing student accommodation services.",
    sectionPriority: ["housing", "student-services"],
  },
  {
    key: "STUDENT_ASSOCIATION",
    label: "Student association",
    description: "A recognized student-led association or network.",
    sectionPriority: ["events", "student-services"],
  },
  {
    key: "EMBASSY_OR_CONSULATE",
    label: "Embassy or consulate",
    description: "A diplomatic mission or consular organization.",
    sectionPriority: [
      "student-services",
      "university-information",
      "events",
    ],
  },
  {
    key: "RECRUITMENT_ORGANIZATION",
    label: "Recruitment organization",
    description: "An organization connecting students with career pathways.",
    sectionPriority: ["jobs", "student-services"],
  },
  {
    key: "SERVICE_PROVIDER",
    label: "Service provider",
    description: "A professional service provider supporting student life.",
    sectionPriority: ["student-services", "products"],
  },
  {
    key: "OTHER",
    label: "Other organization",
    description: "Another organization relevant to Kondo students.",
    sectionPriority: [],
  },
] as const satisfies ReadonlyArray<{
  key: OrganizationType;
  label: string;
  description: string;
  sectionPriority: readonly string[];
}>;

export const ORGANIZATION_TYPE_KEYS = ORGANIZATION_TYPES.map(
  ({ key }) => key,
) as [OrganizationType, ...OrganizationType[]];

export function organizationTypeMetadata(type: OrganizationType | string) {
  return (
    ORGANIZATION_TYPES.find(({ key }) => key === type) ??
    ORGANIZATION_TYPES[ORGANIZATION_TYPES.length - 1]
  );
}

export function organizationTypeLabel(type: OrganizationType | string) {
  return organizationTypeMetadata(type).label;
}
