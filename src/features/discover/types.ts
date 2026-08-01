export const DISCOVER_RESOURCE_TYPES = [
  "organizations",
  "housing",
  "opportunities",
  "products",
  "services",
  "marketplace",
  "communities",
  "universities",
  "cities",
  "events",
] as const;

export type DiscoverResourceType = (typeof DISCOVER_RESOURCE_TYPES)[number];

export type DiscoverItem = {
  id: string;
  type: DiscoverResourceType;
  title: string;
  description: string | null;
  href: string;
  eyebrow: string;
  location: string | null;
  imageUrl: string | null;
  metadata: readonly string[];
  recommendationReason: string | null;
  analytics: { resourceType: DiscoverResourceType; sourceDomain: string };
};

export type DiscoverContext = {
  viewerId: string;
  cityId: string | null;
  universityId: string | null;
  studentJourney: string | null;
};

export type DiscoverFilters = {
  query?: string;
  cityId?: string;
  universityId?: string;
  limit?: number;
};

export type DiscoverProvider = {
  key: DiscoverResourceType;
  label: string;
  description: string;
  cacheTags: readonly string[];
  analyticsSource: string;
  search(
    context: DiscoverContext,
    filters: DiscoverFilters,
  ): Promise<DiscoverItem[]>;
};
