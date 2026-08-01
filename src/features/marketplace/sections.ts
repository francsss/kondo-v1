/**
 * Marketplace section registry.
 *
 * Three visible sections, each backed by its own existing domain — no section
 * owns a copy of another's records:
 *
 *  - Marketplace     → MarketplaceListing (student second-hand goods)
 *  - Food & Services → OrganizationProduct + OrganizationService, read through
 *                      the existing public catalog projection
 *  - Student Skills  → StudentSkillOffer (skills offered by students directly)
 *
 * Community Exchange (currency swaps between students) is removed from the
 * visible product experience. Its `CommunityExchangeOffer` records, routes and
 * services are left untouched; only the navigation entry is gone, and the old
 * query value still resolves so existing links do not break.
 */

export type MarketplaceSectionKey = "marketplace" | "food-services" | "skills";

export type MarketplaceSection = {
  key: MarketplaceSectionKey;
  label: string;
  /** Query value carried by `/marketplace?view=…`; the default view omits it. */
  view: string | null;
  href: string;
  description: string;
  /** Which domain answers for this section. Never a copied table. */
  source: "marketplace-listing" | "organization-catalog" | "student-skill";
};

export const MARKETPLACE_SECTIONS = [
  {
    key: "marketplace",
    label: "Marketplace",
    view: null,
    href: "/marketplace",
    description:
      "Second-hand goods and belongings sold by students and individuals.",
    source: "marketplace-listing",
  },
  {
    key: "food-services",
    label: "Food & Services",
    view: "food-services",
    href: "/marketplace?view=food-services",
    description:
      "Food, shops and professional services published by organizations on Kondo.",
    source: "organization-catalog",
  },
  {
    key: "skills",
    label: "Student Skills",
    view: "skills",
    href: "/marketplace?view=skills",
    description: "Skills and small services offered directly by students.",
    source: "student-skill",
  },
] as const satisfies ReadonlyArray<MarketplaceSection>;

/**
 * Legacy `?view=` values kept working after the section change. Community
 * Exchange resolves to the Marketplace root rather than 404ing an old link.
 */
const LEGACY_VIEWS: Record<string, MarketplaceSectionKey> = {
  exchange: "marketplace",
  "community-exchange": "marketplace",
  // Earlier drafts of this change used a different slug.
  food: "food-services",
  services: "food-services",
};

/** Whether a `?view=` value belongs to a section that no longer exists. */
export function isRetiredMarketplaceView(view: string | undefined) {
  return view === "exchange" || view === "community-exchange";
}

export function resolveMarketplaceSection(
  view: string | undefined,
): MarketplaceSectionKey {
  if (!view) return "marketplace";
  const direct = MARKETPLACE_SECTIONS.find((section) => section.view === view);
  if (direct) return direct.key;
  return LEGACY_VIEWS[view] ?? "marketplace";
}

export function marketplaceSection(key: MarketplaceSectionKey) {
  const section = MARKETPLACE_SECTIONS.find((entry) => entry.key === key);
  if (!section) throw new Error(`Unknown marketplace section: ${key}`);
  return section;
}

/** Position of a section, used only for the directional panel transition. */
export function marketplaceSectionIndex(key: MarketplaceSectionKey) {
  return MARKETPLACE_SECTIONS.findIndex((section) => section.key === key);
}

/**
 * The label shown on every card so a student always knows what they are
 * looking at and cannot confuse a student skill with a registered business.
 */
export const MARKETPLACE_SOURCE_LABELS = {
  "marketplace-item": "Marketplace item",
  "organization-product": "Organization product",
  "organization-service": "Organization service",
  "student-skill": "Student skill",
} as const;

export type MarketplaceSourceLabelKey = keyof typeof MARKETPLACE_SOURCE_LABELS;
