import type { ExploreCity, ExploreEntry } from "@/features/explore/types";

export type CityHubContentMetrics = {
  companyCount: number;
  internshipCount: number;
  restaurantCount: number;
  eventCount: number;
  housingCount: number;
  serviceCount: number;
  totalEntries: number;
  completion: number;
};

type IndexedEntry = {
  entry: ExploreEntry;
  sectionSlug: string;
  sectionTitle: string;
};

function searchableText(item: IndexedEntry) {
  return [
    item.sectionSlug,
    item.sectionTitle,
    item.entry.title,
    item.entry.category,
    ...item.entry.tags,
  ]
    .join(" ")
    .toLowerCase();
}

function hasMeaningfulOverview(city: ExploreCity) {
  return [city.title, city.tagline, city.summary, city.description].every(
    (value) => value.trim().length >= 12,
  );
}

export function cityHubContentMetrics(
  city: ExploreCity | null,
): CityHubContentMetrics {
  if (!city) {
    return {
      companyCount: 0,
      internshipCount: 0,
      restaurantCount: 0,
      eventCount: 0,
      housingCount: 0,
      serviceCount: 0,
      totalEntries: 0,
      completion: 0,
    };
  }

  const entries = city.sections.flatMap((section) =>
    section.entries.map((entry) => ({
      entry,
      sectionSlug: section.slug,
      sectionTitle: section.title,
    })),
  );
  const companyCount = entries.filter(
    ({ entry }) => entry.type === "company",
  ).length;
  const internshipCount = entries.filter((item) => {
    if (item.entry.type !== "opportunity") return false;
    return /\b(internship|internships|stage|stages)\b/i.test(
      searchableText(item),
    );
  }).length;
  const restaurantCount = entries.filter((item) =>
    /\b(restaurant|restaurants|dining|eatery|eateries|cafe|cafes|food)\b/i.test(
      searchableText(item),
    ),
  ).length;
  const eventCount = entries.filter(
    ({ entry }) => entry.type === "event",
  ).length;
  const housingCount = entries.filter((item) =>
    /\b(housing|accommodation|apartment|apartments|rent|rental|logement|logements)\b/i.test(
      searchableText(item),
    ),
  ).length;
  const serviceCount = entries.filter(
    ({ entry }) => entry.type === "service",
  ).length;

  // Ten equally weighted editorial milestones keep the score transparent:
  // identity, overview, signals, impact, and six practical content families.
  const completedMilestones = [
    city.province.trim().length > 0 && city.country.trim().length > 0,
    hasMeaningfulOverview(city),
    city.signals.length >= 2,
    city.impactPoints.length >= 2,
    companyCount > 0,
    internshipCount > 0,
    restaurantCount > 0,
    eventCount > 0,
    housingCount > 0,
    serviceCount > 0,
  ].filter(Boolean).length;

  return {
    companyCount,
    internshipCount,
    restaurantCount,
    eventCount,
    housingCount,
    serviceCount,
    totalEntries: entries.length,
    completion: completedMilestones * 10,
  };
}
