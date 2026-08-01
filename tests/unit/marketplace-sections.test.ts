import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isRetiredMarketplaceView,
  MARKETPLACE_SECTIONS,
  MARKETPLACE_SOURCE_LABELS,
  marketplaceSection,
  marketplaceSectionIndex,
  resolveMarketplaceSection,
} from "@/features/marketplace/sections";
import { DISCOVER_PROVIDERS } from "@/features/discover/registry";
import { DISCOVER_RESOURCE_TYPES } from "@/features/discover/types";

describe("marketplace section structure", () => {
  it("exposes exactly Marketplace, Food & Services and Student Skills", () => {
    expect(MARKETPLACE_SECTIONS.map((section) => section.label)).toEqual([
      "Marketplace",
      "Food & Services",
      "Student Skills",
    ]);
  });

  it("no longer offers Community Exchange anywhere in the navigation", () => {
    const labels = MARKETPLACE_SECTIONS.map((section) =>
      section.label.toLowerCase(),
    );
    expect(labels).not.toContain("community exchange");
    for (const section of MARKETPLACE_SECTIONS) {
      expect(section.href).not.toContain("exchange");
    }
  });

  it("keeps every section backed by its own source domain", () => {
    const sources = MARKETPLACE_SECTIONS.map((section) => section.source);
    expect(sources).toEqual([
      "marketplace-listing",
      "organization-catalog",
      "student-skill",
    ]);
    // No section invents a table of its own.
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("resolves the retired Community Exchange links safely", () => {
    expect(isRetiredMarketplaceView("exchange")).toBe(true);
    expect(isRetiredMarketplaceView("community-exchange")).toBe(true);
    expect(isRetiredMarketplaceView("skills")).toBe(false);
    expect(isRetiredMarketplaceView(undefined)).toBe(false);
    // A retired link still lands somewhere real rather than 404ing.
    expect(resolveMarketplaceSection("exchange")).toBe("marketplace");
  });

  it("resolves current and unknown views deterministically", () => {
    expect(resolveMarketplaceSection(undefined)).toBe("marketplace");
    expect(resolveMarketplaceSection("food-services")).toBe("food-services");
    expect(resolveMarketplaceSection("skills")).toBe("skills");
    expect(resolveMarketplaceSection("nonsense")).toBe("marketplace");
  });

  it("orders sections for a stable panel transition", () => {
    expect(marketplaceSectionIndex("marketplace")).toBe(0);
    expect(marketplaceSectionIndex("food-services")).toBe(1);
    expect(marketplaceSectionIndex("skills")).toBe(2);
  });

  it("rejects an unknown section instead of guessing", () => {
    expect(() => marketplaceSection("exchange" as never)).toThrow(
      /Unknown marketplace section/,
    );
  });

  it("labels every card kind distinctly", () => {
    expect(Object.values(MARKETPLACE_SOURCE_LABELS)).toEqual([
      "Marketplace item",
      "Organization product",
      "Organization service",
      "Student skill",
    ]);
  });
});

describe("marketplace page wiring", () => {
  const source = readFileSync(
    new URL("../../app/(platform)/marketplace/page.tsx", import.meta.url),
    "utf8",
  );

  it("reads Food & Services from the catalog projection, not a copied table", () => {
    expect(source).toContain("listPublicCatalog");
    expect(source).not.toMatch(/prisma\.foodService/);
    expect(source).not.toMatch(/prisma\.marketplaceService/);
  });

  it("redirects the retired exchange view instead of rendering it", () => {
    expect(source).toContain("isRetiredMarketplaceView");
    expect(source).toContain('redirect("/marketplace")');
    expect(source).not.toContain("communityExchangeOffer");
  });

  it("builds its navigation from the section registry", () => {
    expect(source).toContain("MARKETPLACE_SECTIONS");
    // No hard-coded tab, and no link back to the retired section.
    expect(source).not.toMatch(/label:\s*"Community Exchange"/);
    expect(source).not.toContain("?view=exchange");
  });
});

describe("discover aggregation", () => {
  it("covers all four marketplace sources", () => {
    const keys = DISCOVER_PROVIDERS.map((provider) => provider.key);
    expect(keys).toContain("marketplace");
    expect(keys).toContain("products");
    expect(keys).toContain("services");
    expect(keys).toContain("skills");
  });

  it("declares one provider per resource type, with no duplicates", () => {
    const keys = DISCOVER_PROVIDERS.map((provider) => provider.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(DISCOVER_RESOURCE_TYPES).toContain(key);
    }
  });

  it("reads student skills from their own domain", () => {
    const skills = DISCOVER_PROVIDERS.find(
      (provider) => provider.key === "skills",
    );
    expect(skills?.analyticsSource).toBe("student-skill");
    expect(skills?.label).toBe("Student Skills");
  });

  it("never creates a Discover copy of a source record", () => {
    const source = readFileSync(
      new URL("../../src/features/discover/registry.ts", import.meta.url),
      "utf8",
    );
    // Providers only read; a Discover table would need writes.
    expect(source).not.toMatch(/prisma\.discover/i);
    expect(source).not.toMatch(/\.create\(|\.createMany\(|\.upsert\(/);
  });
});
