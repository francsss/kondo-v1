import type { OrganizationCapabilityKey } from "@prisma/client";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  GraduationCap,
  Home,
  Package,
  Users,
} from "lucide-react";

export const ORGANIZATION_CAPABILITIES = [
  {
    key: "HOUSING",
    label: "Housing",
    description: "Help students discover accommodation and housing services.",
    icon: Home,
  },
  {
    key: "SCHOLARSHIPS",
    label: "Scholarships",
    description: "Share scholarship and funding information.",
    icon: GraduationCap,
  },
  {
    key: "INTERNSHIPS_JOBS",
    label: "Internships & jobs",
    description: "Publish professional and early-career opportunities later.",
    icon: BriefcaseBusiness,
  },
  {
    key: "PRODUCTS",
    label: "Products",
    description: "Present useful products when organization publishing opens.",
    icon: Package,
  },
  {
    key: "STUDENT_SERVICES",
    label: "Student services",
    description: "Support students with practical services.",
    icon: Users,
  },
  {
    key: "EVENTS",
    label: "Events",
    description: "Organize and share relevant events.",
    icon: CalendarDays,
  },
  {
    key: "UNIVERSITY_INFORMATION",
    label: "University information",
    description: "Provide trusted information about a university.",
    icon: Building2,
  },
] as const satisfies ReadonlyArray<{
  key: OrganizationCapabilityKey;
  label: string;
  description: string;
  icon: typeof Home;
}>;

export const ORGANIZATION_CAPABILITY_KEYS = ORGANIZATION_CAPABILITIES.map(
  ({ key }) => key,
) as [OrganizationCapabilityKey, ...OrganizationCapabilityKey[]];

export function organizationCapabilityLabel(key: OrganizationCapabilityKey) {
  return (
    ORGANIZATION_CAPABILITIES.find((capability) => capability.key === key)
      ?.label ?? key
  );
}
