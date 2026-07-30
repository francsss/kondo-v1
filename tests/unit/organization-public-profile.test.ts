import { describe, expect, it } from "vitest";
import {
  ORGANIZATION_PUBLIC_SECTION_PROVIDERS,
  visibleOrganizationSections,
} from "@/features/organizations/public-sections";
import {
  normalizeOrganizationContact,
  serializePublicOrganizationContact,
} from "@/lib/organization-contact";
import { organizationTrustPresentation } from "@/lib/organization-public-profile";
import {
  assertOrganizationPublicationTransition,
  canTransitionOrganizationPublication,
  evaluateOrganizationPublicationReadiness,
  type OrganizationPublicationReadinessInput,
} from "@/lib/organization-publication";
import { canExposeOrganizationPublicly } from "@/lib/organization-public-visibility";
import { validateOrganizationSlug } from "@/lib/organization-profile";
import { organizationPublicProfileUpdateSchema } from "@/lib/validation";

const eligible: OrganizationPublicationReadinessInput = {
  publicName: "Kondo Student Network",
  slug: "kondo-student-network",
  type: "STUDENT_ASSOCIATION",
  countryId: "country-1",
  shortDescription: "A public organization serving students in China.",
  logoMediaId: "logo-1",
  lifecycleStatus: "ACTIVE",
  verificationStatus: "VERIFIED",
  representationConfirmed: true,
  publicProfileBlocked: false,
  publicProfileBlockReason: null,
  publicContactTypes: ["WEBSITE"],
  publicMediaCount: 1,
  activeOwnerCount: 1,
};

describe("organization public publication", () => {
  it("computes deterministic server-side readiness and keeps logo optional", () => {
    expect(evaluateOrganizationPublicationReadiness(eligible).isReady).toBe(
      true,
    );
    const withoutLogo = evaluateOrganizationPublicationReadiness({
      ...eligible,
      logoMediaId: null,
    });
    expect(withoutLogo.isReady).toBe(true);
    expect(withoutLogo.warnings.map(({ key }) => key)).toContain("logo");
  });

  it("blocks missing public identity, contact and owner requirements", () => {
    const result = evaluateOrganizationPublicationReadiness({
      ...eligible,
      publicName: " ",
      publicContactTypes: [],
      activeOwnerCount: 0,
    });
    expect(result.isReady).toBe(false);
    expect(result.missingRequirements.map(({ key }) => key)).toEqual(
      expect.arrayContaining(["publicName", "contact", "owner"]),
    );
  });

  it.each(["SUSPENDED", "ARCHIVED"] as const)(
    "blocks %s organizations",
    (lifecycleStatus) => {
      const result = evaluateOrganizationPublicationReadiness({
        ...eligible,
        lifecycleStatus,
      });
      expect(result.isReady).toBe(false);
      expect(result.blockingReasons[0]?.key).toBe("lifecycle");
    },
  );

  it("enforces the publication state machine", () => {
    expect(canTransitionOrganizationPublication("PRIVATE", "READY")).toBe(true);
    expect(canTransitionOrganizationPublication("READY", "PUBLISHED")).toBe(
      true,
    );
    expect(
      canTransitionOrganizationPublication("PUBLISHED", "UNPUBLISHED"),
    ).toBe(true);
    expect(canTransitionOrganizationPublication("PRIVATE", "PUBLISHED")).toBe(
      false,
    );
    expect(() =>
      assertOrganizationPublicationTransition("PRIVATE", "PUBLISHED"),
    ).toThrow(/cannot move/i);
  });

  it("does not accept client-controlled trust or lifecycle fields", () => {
    const parsed = organizationPublicProfileUpdateSchema.parse({
      tagline: "Student support",
      serviceAreas: [],
      supportedLanguages: [],
      representationConfirmed: true,
      contacts: [],
      verificationStatus: "VERIFIED",
      isOfficialPartner: true,
      lifecycleStatus: "ACTIVE",
      publicProfileStatus: "PUBLISHED",
    });
    expect(parsed).not.toHaveProperty("verificationStatus");
    expect(parsed).not.toHaveProperty("isOfficialPartner");
    expect(parsed).not.toHaveProperty("lifecycleStatus");
    expect(parsed).not.toHaveProperty("publicProfileStatus");
  });
});

describe("organization public visibility and trust", () => {
  it("exposes only active, published and unrestricted organizations", () => {
    expect(
      canExposeOrganizationPublicly({
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        publicProfileBlockedAt: null,
      }),
    ).toBe(true);
    for (const input of [
      { lifecycleStatus: "ACTIVE", publicProfileStatus: "PRIVATE" },
      { lifecycleStatus: "ACTIVE", publicProfileStatus: "READY" },
      { lifecycleStatus: "ACTIVE", publicProfileStatus: "UNPUBLISHED" },
      { lifecycleStatus: "SUSPENDED", publicProfileStatus: "PUBLISHED" },
      { lifecycleStatus: "ARCHIVED", publicProfileStatus: "PUBLISHED" },
    ]) {
      expect(canExposeOrganizationPublicly(input)).toBe(false);
    }
    expect(
      canExposeOrganizationPublicly({
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        publicProfileBlockedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("keeps verification and partnership distinct", () => {
    expect(
      organizationTrustPresentation({
        verificationStatus: "NOT_SUBMITTED",
        isOfficialPartner: false,
      }),
    ).toMatchObject({
      verification: { state: "UNVERIFIED" },
      partner: { active: false },
    });
    expect(
      organizationTrustPresentation({
        verificationStatus: "VERIFIED",
        isOfficialPartner: false,
      }),
    ).toMatchObject({
      verification: { state: "VERIFIED" },
      partner: { active: false },
    });
    expect(
      organizationTrustPresentation({
        verificationStatus: "VERIFIED",
        isOfficialPartner: true,
      }),
    ).toMatchObject({
      verification: { state: "VERIFIED" },
      partner: { active: true },
    });
    expect(
      organizationTrustPresentation({
        verificationStatus: "REVOKED",
        isOfficialPartner: true,
      }),
    ).toMatchObject({
      verification: { state: "UNVERIFIED" },
      partner: { active: false },
    });
  });
});

describe("organization public sections and contacts", () => {
  it("hides empty sections and keeps ordering deterministic", () => {
    const sections = visibleOrganizationSections({
      hasOverview: true,
      hasAbout: false,
      capabilityCount: 2,
      galleryCount: 0,
      contactCount: 1,
      hasCity: true,
    });
    expect(sections.map(({ key }) => key)).toEqual([
      "overview",
      "capabilities",
      "contact",
      "city-context",
    ]);
  });

  it("does not make a future content section visible from capability alone", async () => {
    const housingProvider = ORGANIZATION_PUBLIC_SECTION_PROVIDERS.find(
      ({ key }) => key === "housing",
    )!;
    expect(await housingProvider.getProjection("organization-1")).toMatchObject(
      {
        available: false,
        itemCount: 0,
        visibility: "HIDDEN",
      },
    );
  });

  it("excludes private channels and serializes public channels safely", () => {
    expect(
      serializePublicOrganizationContact({
        id: "private",
        type: "EMAIL",
        label: null,
        value: "private@example.org",
        visibility: "PRIVATE",
      }),
    ).toBeNull();
    expect(
      serializePublicOrganizationContact({
        id: "email",
        type: "EMAIL",
        label: null,
        value: "HELLO@EXAMPLE.ORG",
        visibility: "PUBLIC",
      }),
    ).toMatchObject({
      value: "hello@example.org",
      href: "mailto:hello@example.org",
    });
    expect(
      serializePublicOrganizationContact({
        id: "phone",
        type: "PHONE",
        label: null,
        value: "+86 123 456 789",
        visibility: "PUBLIC",
      }),
    ).toMatchObject({ href: "tel:+86123456789" });
  });

  it("rejects unsafe URLs and protected slugs", () => {
    expect(() =>
      normalizeOrganizationContact({
        type: "WEBSITE",
        value: "javascript:alert(1)",
        visibility: "PUBLIC",
      }),
    ).toThrow(/HTTP|HTTPS/i);
    expect(() => validateOrganizationSlug("messages")).toThrow(/reserved/i);
    expect(() => validateOrganizationSlug("public-profile")).toThrow(
      /reserved/i,
    );
  });
});
