import { describe, expect, it } from "vitest";
import {
  COUNTRIES,
  COUNTRY_CODES,
  countriesInRegion,
  countrySelectOptions,
  getCountry,
  isCountryCode,
} from "@/lib/countries";

describe("Kondo country reference", () => {
  it("covers the world, not one region", () => {
    // Kondo is for international students in China. A regional subset here is
    // not a shorter list — it is a registration form that rejects people.
    expect(COUNTRIES.length).toBeGreaterThan(200);
    for (const region of [
      "Africa",
      "Americas",
      "Asia",
      "Europe",
      "Oceania",
    ] as const) {
      expect(countriesInRegion(region).length).toBeGreaterThan(20);
    }
  });

  it("accepts every origin the product promises", () => {
    // One from each region, including the launch market and the host country.
    for (const [code, name] of [
      ["CM", "Cameroon"],
      ["NG", "Nigeria"],
      ["RW", "Rwanda"],
      ["PK", "Pakistan"],
      ["IN", "India"],
      ["ID", "Indonesia"],
      ["KZ", "Kazakhstan"],
      ["TH", "Thailand"],
      ["VN", "Vietnam"],
      ["CN", "China"],
      ["FR", "France"],
      ["RU", "Russia"],
      ["US", "United States"],
    ]) {
      expect(getCountry(code)).toMatchObject({ code, name });
    }
  });

  it("keeps Africa as a region rather than the definition", () => {
    // Africa remains a real dimension — national communities depend on it —
    // it is simply no longer the whole list.
    const africa = countriesInRegion("Africa");
    expect(africa.map((country) => country.code)).toContain("CM");
    expect(africa.length).toBeLessThan(COUNTRIES.length / 2);
  });

  it("stores stable ISO 3166-1 alpha-2 codes", () => {
    for (const country of COUNTRIES) {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      expect(country.name.trim()).toBe(country.name);
      expect(country.emoji.length).toBeGreaterThan(0);
    }
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRIES.length);
    expect(new Set(COUNTRIES.map((country) => country.name)).size).toBe(
      COUNTRIES.length,
    );
  });

  it("is sorted by name so the selector reads alphabetically", () => {
    const names = COUNTRIES.map((country) => country.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("looks codes up forgivingly and rejects what is not a country", () => {
    expect(getCountry("pk")).toMatchObject({ code: "PK" });
    expect(getCountry(" pk ")).toMatchObject({ code: "PK" });
    expect(isCountryCode("ZZ")).toBe(false);
    expect(isCountryCode("")).toBe(false);
    expect(isCountryCode(null)).toBe(false);
    expect(getCountry(undefined)).toBeNull();
  });

  it("offers select options carrying the flag and a searchable region", () => {
    const options = countrySelectOptions();
    expect(options).toHaveLength(COUNTRIES.length);
    const pakistan = options.find((option) => option.id === "PK");
    expect(pakistan?.name).toContain("Pakistan");
    expect(pakistan?.secondary).toBe("Asia");
  });
});
