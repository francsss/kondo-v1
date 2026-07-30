import type {
  OrganizationCapabilityKey,
  OrganizationCapabilityStatus,
  OrganizationLifecycleStatus,
} from "@prisma/client";
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  GraduationCap,
  Home,
  Package,
  Users,
} from "lucide-react";
import {
  hasOrganizationPermission,
  type OrganizationMembershipContext,
} from "@/lib/organization-authorization";
import { organizationAllowsPublishing } from "@/lib/organization-lifecycle";

export const ORGANIZATION_CAPABILITIES = [
  {
    key: "HOUSING",
    label: "Housing",
    description: "Help students discover accommodation and housing services.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: Home,
  },
  {
    key: "SCHOLARSHIPS",
    label: "Scholarships",
    description: "Share scholarship and funding information.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: GraduationCap,
  },
  {
    key: "INTERNSHIPS_JOBS",
    label: "Internships & jobs",
    description: "Publish professional and early-career opportunities later.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: BriefcaseBusiness,
  },
  {
    key: "PRODUCTS",
    label: "Products",
    description: "Present useful products when organization publishing opens.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: Package,
  },
  {
    key: "STUDENT_SERVICES",
    label: "Student services",
    description: "Support students with practical services.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: Users,
  },
  {
    key: "EVENTS",
    label: "Events",
    description: "Organize and share relevant events.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: CalendarDays,
  },
  {
    key: "UNIVERSITY_INFORMATION",
    label: "University information",
    description: "Provide trusted information about a university.",
    permission: "ORGANIZATION_CREATE_CONTENT",
    icon: Building2,
  },
] as const satisfies ReadonlyArray<{
  key: OrganizationCapabilityKey;
  label: string;
  description: string;
  permission: "ORGANIZATION_CREATE_CONTENT";
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

export function isOrganizationCapabilityKey(
  value: string,
): value is OrganizationCapabilityKey {
  return ORGANIZATION_CAPABILITY_KEYS.includes(
    value as OrganizationCapabilityKey,
  );
}

export function organizationCapabilityMetadata(key: OrganizationCapabilityKey) {
  return ORGANIZATION_CAPABILITIES.find(
    (capability) => capability.key === key,
  )!;
}

export function canUseOrganizationCapability(input: {
  key: OrganizationCapabilityKey;
  status: OrganizationCapabilityStatus;
  lifecycleStatus: OrganizationLifecycleStatus;
  membership: OrganizationMembershipContext | null | undefined;
}) {
  const capability = organizationCapabilityMetadata(input.key);
  return (
    input.status === "ENABLED" &&
    organizationAllowsPublishing(input.lifecycleStatus) &&
    hasOrganizationPermission(input.membership, capability.permission)
  );
}
