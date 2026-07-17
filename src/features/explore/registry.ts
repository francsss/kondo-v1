import { jiaxingCity } from "@/features/explore/cities/jiaxing";
import type { ExploreCity, ExploreSection } from "@/features/explore/types";

const cityRegistry = [jiaxingCity] as const satisfies readonly ExploreCity[];

export function listExploreCities(): readonly ExploreCity[] {
  return cityRegistry;
}

export function getExploreCity(citySlug: string): ExploreCity | undefined {
  return cityRegistry.find((city) => city.slug === citySlug);
}

export function getExploreSection(
  city: ExploreCity,
  sectionSlug: string,
): ExploreSection | undefined {
  return city.sections.find((section) => section.slug === sectionSlug);
}

export function getExploreCityParams() {
  return cityRegistry.map((city) => ({ city: city.slug }));
}

export function getExploreSectionParams() {
  return cityRegistry.flatMap((city) =>
    city.sections.map((section) => ({
      city: city.slug,
      section: section.slug,
    })),
  );
}
