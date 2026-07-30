import type { OrganizationType } from "@prisma/client";

export const ORGANIZATION_TYPES = [
  {
    key: "COMPANY",
    label: "Company",
    description: "A company serving students or the wider China ecosystem.",
    sectionPriority: ["about", "capabilities", "jobs", "products", "events"],
  },
  {
    key: "UNIVERSITY",
    label: "University",
    description: "A university or higher-education institution.",
    sectionPriority: [
      "about",
      "university-information",
      "scholarships",
      "events",
    ],
  },
  {
    key: "EDUCATION_AGENCY",
    label: "Education agency",
    description: "An education consultancy or student admissions agency.",
    sectionPriority: ["about", "scholarships", "student-services"],
  },
  {
    key: "HOUSING_PROVIDER",
    label: "Housing provider",
    description: "An organization providing student accommodation services.",
    sectionPriority: ["about", "housing", "student-services"],
  },
  {
    key: "STUDENT_ASSOCIATION",
    label: "Student association",
    description: "A recognized student-led association or network.",
    sectionPriority: ["about", "events", "student-services"],
  },
  {
    key: "EMBASSY_OR_CONSULATE",
    label: "Embassy or consulate",
    description: "A diplomatic mission or consular organization.",
    sectionPriority: [
      "about",
      "student-services",
      "university-information",
      "events",
    ],
  },
  {
    key: "RECRUITMENT_ORGANIZATION",
    label: "Recruitment organization",
    description: "An organization connecting students with career pathways.",
    sectionPriority: ["about", "jobs", "student-services"],
  },
  {
    key: "SERVICE_PROVIDER",
    label: "Service provider",
    description: "A professional service provider supporting student life.",
    sectionPriority: ["about", "student-services", "products"],
  },
  {
    key: "OTHER",
    label: "Other organization",
    description: "Another organization relevant to Kondo students.",
    sectionPriority: ["about", "capabilities"],
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
