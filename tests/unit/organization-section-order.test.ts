import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_HOUSING_PUBLIC_SECTION,
  ORGANIZATION_JOBS_PUBLIC_SECTION,
  ORGANIZATION_PRODUCTS_PUBLIC_SECTION,
  ORGANIZATION_SCHOLARSHIPS_PUBLIC_SECTION,
  ORGANIZATION_SERVICES_PUBLIC_SECTION,
  orderOrganizationSections,
  visibleOrganizationSections,
} from "@/features/organizations/public-sections";
import { ORGANIZATION_TYPES } from "@/features/organizations/registry";

const fullBase = visibleOrganizationSections({
  hasOverview: true,
  hasAbout: true,
  capabilityCount: 2,
  galleryCount: 3,
  contactCount: 1,
  hasCity: true,
});

function order(
  domain: ReadonlyArray<{ key: string; order: number }>,
  type: string,
) {
  return orderOrganizationSections([...fullBase, ...domain], type).map(
    ({ key }) => key,
  );
}

describe("public organization section order", () => {
  it("never opens a profile on About when the organization publishes value", () => {
    for (const { key: type } of ORGANIZATION_TYPES) {
      const keys = order(
        [
          ORGANIZATION_PRODUCTS_PUBLIC_SECTION,
          ORGANIZATION_SERVICES_PUBLIC_SECTION,
          ORGANIZATION_HOUSING_PUBLIC_SECTION,
        ],
        type,
      );
      expect(keys[0], `first section for ${type}`).not.toBe("about");
      expect(keys[0], `first section for ${type}`).not.toBe("overview");
    }
  });

  it("leads a housing provider with housing and a company with products", () => {
    const domain = [
      ORGANIZATION_PRODUCTS_PUBLIC_SECTION,
      ORGANIZATION_HOUSING_PUBLIC_SECTION,
      ORGANIZATION_SERVICES_PUBLIC_SECTION,
    ];
    expect(order(domain, "HOUSING_PROVIDER")[0]).toBe("housing");
    expect(order(domain, "COMPANY")[0]).toBe("products");
    expect(order(domain, "SERVICE_PROVIDER")[0]).toBe("student-services");
  });

  it("leads a recruitment organization with jobs and an agency with scholarships", () => {
    const domain = [
      ORGANIZATION_JOBS_PUBLIC_SECTION,
      ORGANIZATION_SCHOLARSHIPS_PUBLIC_SECTION,
    ];
    expect(order(domain, "RECRUITMENT_ORGANIZATION")[0]).toBe("jobs");
    expect(order(domain, "EDUCATION_AGENCY")[0]).toBe("scholarships");
  });

  it("falls back to value-before-context when the type prioritises nothing", () => {
    expect(order([ORGANIZATION_PRODUCTS_PUBLIC_SECTION], "OTHER")).toEqual([
      "products",
      "overview",
      "about",
      "capabilities",
      "gallery",
      "contact",
      "city-context",
    ]);
  });

  it("keeps context sections in a stable order behind the value sections", () => {
    expect(order([], "COMPANY")).toEqual([
      "overview",
      "about",
      "capabilities",
      "gallery",
      "contact",
      "city-context",
    ]);
  });

  it("only promotes a prioritised section that actually has content", () => {
    // A company prioritises products, but this one publishes services only.
    expect(order([ORGANIZATION_SERVICES_PUBLIC_SECTION], "COMPANY")[0]).toBe(
      "student-services",
    );
  });
});
