import { describe, expect, it } from "vitest";
import { resolveSignedInLanding } from "@/lib/onboarding-routing";

describe("signed-in onboarding routing", () => {
  it("keeps completed personal accounts on the existing home destination", () => {
    expect(
      resolveSignedInLanding({
        onboardingCompletedAt: new Date(),
        onboardingIntent: "PERSONAL",
      }),
    ).toBe("/home");
  });

  it("resumes an unfinished owned organization draft", () => {
    expect(
      resolveSignedInLanding({
        onboardingCompletedAt: null,
        onboardingIntent: "ORGANIZATION",
        organizationMemberships: [
          {
            role: "OWNER",
            status: "ACTIVE",
            organization: {
              lifecycleStatus: "DRAFT",
              setupCompletedAt: null,
            },
          },
        ],
      }),
    ).toBe("/onboarding/organization");
  });

  it("routes legacy accounts without an intent through personal onboarding", () => {
    expect(
      resolveSignedInLanding({
        onboardingCompletedAt: null,
        onboardingIntent: null,
        organizationMemberships: [],
      }),
    ).toBe("/onboarding/personal");
  });

  it("does not force a completed organization operator through personal onboarding", () => {
    expect(
      resolveSignedInLanding({
        onboardingCompletedAt: null,
        onboardingIntent: "ORGANIZATION",
        organizationMemberships: [
          {
            role: "OWNER",
            status: "ACTIVE",
            organization: {
              lifecycleStatus: "ACTIVE",
              setupCompletedAt: new Date(),
            },
          },
        ],
      }),
    ).toBe("/home");
  });
});
