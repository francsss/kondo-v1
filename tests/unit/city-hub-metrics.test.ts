import { describe, expect, it } from "vitest";
import type { ExploreCity, ExploreEntry } from "@/features/explore/types";
import { cityHubContentMetrics } from "@/lib/city-hub-metrics";

function entry(
  type: ExploreEntry["type"],
  title: string,
  category: string,
): ExploreEntry {
  const slug = title.toLowerCase().replaceAll(" ", "-");
  return {
    id: slug,
    slug,
    type,
    title,
    category,
    summary: `${title} summary`,
    tags: [],
    details: [],
  };
}

function city(entries: ExploreEntry[]): ExploreCity {
  return {
    slug: "hangzhou",
    name: "Hangzhou",
    province: "Zhejiang",
    country: "China",
    eyebrow: "Kondo city guide · Hangzhou",
    title: "Hangzhou, open by design.",
    tagline: "Discover Hangzhou with Kondo.",
    summary: "A student-first gateway to Hangzhou.",
    description: "Practical, reviewed information for students in Hangzhou.",
    signals: [
      { label: "Students", value: "Growing" },
      { label: "Content", value: "Reviewed" },
    ],
    impactPoints: [
      { title: "Arrive", description: "Settle faster." },
      { title: "Grow", description: "Find opportunities." },
    ],
    sections: [
      {
        slug: "city-guide",
        title: "City guide",
        shortTitle: "Guide",
        eyebrow: "Student essentials",
        summary: "The useful parts of the city.",
        description: "Verified practical information.",
        icon: "services",
        accent: "emerald",
        signal: "Six content areas",
        studentValue: "Save time.",
        cityValue: "Welcome students.",
        entries,
      },
    ],
  };
}

describe("city hub content metrics", () => {
  it("returns zeroes for a city without a CMS draft", () => {
    expect(cityHubContentMetrics(null)).toMatchObject({
      companyCount: 0,
      internshipCount: 0,
      restaurantCount: 0,
      eventCount: 0,
      totalEntries: 0,
      completion: 0,
    });
  });

  it("counts practical content and produces a bounded completion score", () => {
    const metrics = cityHubContentMetrics(
      city([
        entry("company", "Kondo Partner", "Technology"),
        entry("opportunity", "Summer placement", "Internship"),
        entry("service", "Student Kitchen", "Restaurant"),
        entry("event", "Welcome Fair", "Campus event"),
        entry("service", "Student Apartments", "Housing"),
        entry("service", "Visa Centre", "Administration"),
      ]),
    );

    expect(metrics).toEqual({
      companyCount: 1,
      internshipCount: 1,
      restaurantCount: 1,
      eventCount: 1,
      housingCount: 1,
      serviceCount: 3,
      totalEntries: 6,
      completion: 100,
    });
  });

  it("does not count every opportunity as an internship", () => {
    const metrics = cityHubContentMetrics(
      city([entry("opportunity", "Graduate role", "Full-time job")]),
    );
    expect(metrics.internshipCount).toBe(0);
    expect(metrics.completion).toBeLessThanOrEqual(100);
  });
});
