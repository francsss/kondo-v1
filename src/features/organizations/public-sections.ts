import type {
  OrganizationCapabilityKey,
  OrganizationType,
} from "@prisma/client";
import { organizationTypeMetadata } from "@/features/organizations/registry";
import { getOrganizationHousingProjection } from "@/lib/housing-projections";
import {
  getOrganizationJobsProjection,
  getOrganizationProgramsProjection,
  getOrganizationScholarshipProjection,
} from "@/lib/opportunity-projections";
import { getOrganizationCatalogProjection } from "@/lib/organization-catalog";

export type OrganizationPublicSectionKey =
  | "overview"
  | "about"
  | "capabilities"
  | "gallery"
  | "contact"
  | "city-context"
  | "housing"
  | "scholarships"
  | "jobs"
  | "products"
  | "student-services"
  | "events"
  | "university-information";

export type OrganizationPublicProjection = {
  available: boolean;
  itemCount: number;
  featuredItems: readonly {
    id: string;
    title: string;
    href: string;
    context?: string | null;
    /** Cover image, when the owning domain publishes one. */
    imageUrl?: string | null;
  }[];
  sectionRoute: string | null;
  visibility: "PUBLIC" | "HIDDEN";
};

export type OrganizationPublicSectionProvider = {
  key: string;
  capability: OrganizationCapabilityKey;
  getProjection(organizationId: string): Promise<OrganizationPublicProjection>;
};

const unavailableProjection =
  async (): Promise<OrganizationPublicProjection> => ({
    available: false,
    itemCount: 0,
    featuredItems: [],
    sectionRoute: null,
    visibility: "HIDDEN",
  });

// Later domain modules replace one bounded provider at a time. They remain the
// owners of their records and public visibility; this registry never stores a
// second generic copy of Housing, Scholarship, Job, Product, Service or Event.
export const ORGANIZATION_PUBLIC_SECTION_PROVIDERS: ReadonlyArray<OrganizationPublicSectionProvider> =
  [
    {
      key: "housing",
      capability: "HOUSING",
      getProjection: getOrganizationHousingProjection,
    },
    {
      key: "scholarships",
      capability: "SCHOLARSHIPS",
      getProjection: getOrganizationScholarshipProjection,
    },
    {
      key: "jobs",
      capability: "INTERNSHIPS_JOBS",
      getProjection: getOrganizationJobsProjection,
    },
    {
      key: "products",
      capability: "PRODUCTS",
      getProjection: (organizationId) =>
        getOrganizationCatalogProjection("product", organizationId),
    },
    {
      key: "student-services",
      capability: "STUDENT_SERVICES",
      getProjection: (organizationId) =>
        getOrganizationCatalogProjection("service", organizationId),
    },
    {
      key: "events",
      capability: "EVENTS",
      getProjection: getOrganizationProgramsProjection,
    },
    {
      key: "university-information",
      capability: "UNIVERSITY_INFORMATION",
      getProjection: unavailableProjection,
    },
  ];

export const ORGANIZATION_PUBLIC_SECTIONS = [
  {
    key: "overview",
    label: "Overview",
    icon: "sparkles",
    order: 20,
    accessibilityLabel: "Organization overview",
    analyticsId: "overview",
    futureProviderKey: null,
  },
  {
    key: "about",
    label: "About",
    icon: "building",
    order: 30,
    accessibilityLabel: "About this organization",
    analyticsId: "about",
    futureProviderKey: null,
  },
  {
    key: "capabilities",
    label: "Activity areas",
    icon: "grid",
    order: 40,
    accessibilityLabel: "Organization activity areas",
    analyticsId: "capabilities",
    futureProviderKey: null,
  },
  {
    key: "gallery",
    label: "Gallery",
    icon: "image",
    order: 50,
    accessibilityLabel: "Organization image gallery",
    analyticsId: "gallery",
    futureProviderKey: null,
  },
  {
    key: "contact",
    label: "Contact",
    icon: "contact",
    order: 60,
    accessibilityLabel: "Public organization contact details",
    analyticsId: "contact",
    futureProviderKey: null,
  },
  {
    key: "city-context",
    label: "City",
    icon: "map",
    order: 70,
    accessibilityLabel: "Related Kondo city guide",
    analyticsId: "city_context",
    futureProviderKey: null,
  },
] as const;

export const ORGANIZATION_SCHOLARSHIPS_PUBLIC_SECTION = {
  key: "scholarships",
  label: "Scholarships",
  icon: "graduation-cap",
  order: 13,
  accessibilityLabel: "Scholarships published by this organization",
  analyticsId: "scholarships",
  futureProviderKey: "scholarships",
} as const;

export const ORGANIZATION_JOBS_PUBLIC_SECTION = {
  key: "jobs",
  label: "Internships & jobs",
  icon: "briefcase",
  order: 14,
  accessibilityLabel: "Internships and jobs published by this organization",
  analyticsId: "jobs",
  futureProviderKey: "jobs",
} as const;

export const ORGANIZATION_HOUSING_PUBLIC_SECTION = {
  key: "housing",
  label: "Housing",
  icon: "home",
  order: 12,
  accessibilityLabel: "Housing published by this organization",
  analyticsId: "housing",
  futureProviderKey: "housing",
} as const;

export const ORGANIZATION_PRODUCTS_PUBLIC_SECTION = {
  key: "products",
  label: "Products",
  icon: "package",
  order: 10,
  accessibilityLabel: "Products published by this organization",
  analyticsId: "products",
  futureProviderKey: "products",
} as const;

export const ORGANIZATION_SERVICES_PUBLIC_SECTION = {
  key: "student-services",
  label: "Services",
  icon: "users",
  order: 11,
  accessibilityLabel: "Student services published by this organization",
  analyticsId: "student_services",
  futureProviderKey: "student-services",
} as const;

type OrderedSection = { key: string; order: number };

/**
 * Orders the visible sections of a public profile.
 *
 * Value sections carry the lowest base order, so the first tab always answers
 * "what does this organization offer?" rather than opening on About. Within
 * those, the organization type's own `sectionPriority` decides which one
 * leads: a housing provider opens on Housing, a company on Products. Sections
 * the type does not prioritise keep their default order.
 */
export function orderOrganizationSections<Section extends OrderedSection>(
  sections: readonly Section[],
  organizationType: OrganizationType | string,
): Section[] {
  const priority: readonly string[] =
    organizationTypeMetadata(organizationType).sectionPriority;
  const rank = (section: Section) => {
    const index = priority.indexOf(section.key);
    // Prioritised value sections sort ahead of every default order.
    return index === -1 ? section.order : index - priority.length;
  };
  return [...sections].sort((first, second) => rank(first) - rank(second));
}

export function visibleOrganizationSections(input: {
  hasOverview: boolean;
  hasAbout: boolean;
  capabilityCount: number;
  galleryCount: number;
  contactCount: number;
  hasCity: boolean;
}) {
  const visible = new Set<OrganizationPublicSectionKey>();
  if (input.hasOverview) visible.add("overview");
  if (input.hasAbout) visible.add("about");
  if (input.capabilityCount) visible.add("capabilities");
  if (input.galleryCount) visible.add("gallery");
  if (input.contactCount) visible.add("contact");
  if (input.hasCity) visible.add("city-context");
  return ORGANIZATION_PUBLIC_SECTIONS.filter(({ key }) => visible.has(key));
}
