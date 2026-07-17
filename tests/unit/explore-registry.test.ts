import { describe, expect, it } from "vitest";
import {
  getExploreCity,
  getExploreSectionParams,
  listExploreCities,
} from "@/features/explore/registry";

describe("explore city registry", () => {
  it("exposes Jiaxing through the generic multi-city contract", () => {
    const city = getExploreCity("jiaxing");
    expect(city?.name).toBe("Jiaxing");
    expect(city?.sections.map((section) => section.slug)).toEqual([
      "companies",
      "products",
      "universities",
      "jobs",
      "events",
      "services",
      "about",
    ]);
  });

  it("keeps city, section, and entry identifiers unique", () => {
    const cities = listExploreCities();
    expect(new Set(cities.map((city) => city.slug)).size).toBe(cities.length);

    for (const city of cities) {
      expect(new Set(city.sections.map((section) => section.slug)).size).toBe(
        city.sections.length,
      );
      for (const section of city.sections) {
        expect(new Set(section.entries.map((entry) => entry.id)).size).toBe(
          section.entries.length,
        );
        expect(new Set(section.entries.map((entry) => entry.slug)).size).toBe(
          section.entries.length,
        );
      }
    }
  });

  it("generates every future-compatible section route", () => {
    expect(getExploreSectionParams()).toHaveLength(7);
    expect(getExploreSectionParams()).toContainEqual({
      city: "jiaxing",
      section: "events",
    });
  });
});
