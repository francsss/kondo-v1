import type { OrganizationCapabilityKey } from "@prisma/client";
import { getOrganizationHousingProjection } from "@/lib/housing-projections";

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
      getProjection: unavailableProjection,
    },
    {
      key: "jobs",
      capability: "INTERNSHIPS_JOBS",
      getProjection: unavailableProjection,
    },
    {
      key: "products",
      capability: "PRODUCTS",
      getProjection: unavailableProjection,
    },
    {
      key: "student-services",
      capability: "STUDENT_SERVICES",
      getProjection: unavailableProjection,
    },
    {
      key: "events",
      capability: "EVENTS",
      getProjection: unavailableProjection,
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
    order: 10,
    accessibilityLabel: "Organization overview",
    analyticsId: "overview",
    futureProviderKey: null,
  },
  {
    key: "about",
    label: "About",
    icon: "building",
    order: 20,
    accessibilityLabel: "About this organization",
    analyticsId: "about",
    futureProviderKey: null,
  },
  {
    key: "capabilities",
    label: "Activity areas",
    icon: "grid",
    order: 30,
    accessibilityLabel: "Organization activity areas",
    analyticsId: "capabilities",
    futureProviderKey: null,
  },
  {
    key: "gallery",
    label: "Gallery",
    icon: "image",
    order: 40,
    accessibilityLabel: "Organization image gallery",
    analyticsId: "gallery",
    futureProviderKey: null,
  },
  {
    key: "contact",
    label: "Contact",
    icon: "contact",
    order: 50,
    accessibilityLabel: "Public organization contact details",
    analyticsId: "contact",
    futureProviderKey: null,
  },
  {
    key: "city-context",
    label: "City",
    icon: "map",
    order: 60,
    accessibilityLabel: "Related Kondo city guide",
    analyticsId: "city_context",
    futureProviderKey: null,
  },
] as const;

export const ORGANIZATION_HOUSING_PUBLIC_SECTION = {
  key: "housing",
  label: "Housing",
  icon: "home",
  order: 35,
  accessibilityLabel: "Housing published by this organization",
  analyticsId: "housing",
  futureProviderKey: "housing",
} as const;

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
