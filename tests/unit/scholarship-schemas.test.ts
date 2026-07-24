import { describe, expect, it } from "vitest";
import {
  scholarshipAgentInputSchema,
  scholarshipInputSchema,
} from "@/features/scholarships/schemas";

describe("scholarship CMS validation", () => {
  it("accepts a complete scholarship and validates its date window", () => {
    const input = {
      title: "Kondo International Scholarship",
      provider: "Kondo University",
      countryId: null,
      universityIds: [],
      city: null,
      studyLevels: ["MASTERS"],
      fields: ["Computer Science"],
      eligibleNationalities: ["Ghanaian"],
      fundingType: "FULL",
      status: "OPEN",
      opensAt: "2027-01-01",
      closesAt: "2027-03-31",
      applicationUrl: "https://example.edu/apply",
      description:
        "A complete funding opportunity for high-achieving international students.",
      eligibilityCriteria: ["Bachelor degree"],
      requiredDocuments: ["Transcript"],
      coverage: ["Tuition"],
      applicationSteps: ["Create an account"],
      isFeatured: true,
      isActive: true,
      markVerified: true,
    };
    expect(scholarshipInputSchema.safeParse(input).success).toBe(true);
    expect(
      scholarshipInputSchema.safeParse({
        ...input,
        opensAt: "2027-04-01",
        closesAt: "2027-03-31",
      }).success,
    ).toBe(false);
  });

  it("accepts a complete verified agent profile", () => {
    expect(
      scholarshipAgentInputSchema.safeParse({
        name: "Ama Scholar",
        company: "Scholar Bridge",
        logoUrl: "https://example.com/logo.png",
        countryId: null,
        languages: ["English", "French"],
        specialties: ["China", "CSC", "PhD"],
        services: ["Application review"],
        feeDetails: "First consultation is free.",
        whatsapp: "+233200000000",
        wechat: "ama-scholar",
        email: "ama@example.com",
        website: "https://example.com",
        availability: "AVAILABLE",
        averageRating: 4.8,
        biography: "International admissions adviser.",
        verified: true,
        isActive: true,
      }).success,
    ).toBe(true);
  });
});
