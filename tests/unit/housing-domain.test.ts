import { describe, expect, it } from "vitest";
import {
  housingListingInputSchema,
  roommateDiscoverySchema,
  housingSearchSchema,
  roommateProfileInputSchema,
} from "@/features/housing/schemas";
import { publicHousingListingSelect } from "@/lib/housing-listings";
import {
  assertHousingListingTransition,
  housingListingTransitions,
} from "@/lib/housing-lifecycle";
import {
  privacySafeHousingCoordinate,
  safeHousingMapPoint,
} from "@/lib/housing-location";
import { canPublishPersonalHousingType } from "@/lib/housing-permissions";
import { housingSearchWhere } from "@/lib/housing-search";
import {
  canExposeHousingListingPublicly,
  canExposeHousingRequest,
  canExposeRoommateProfile,
} from "@/lib/housing-visibility";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { roommateBudgetsOverlap } from "@/lib/roommate-profiles";

const id = "clh1234567890";

function listingInput() {
  return {
    publisherType: "PERSONAL",
    organizationId: null,
    type: "PRIVATE_ROOM",
    title: "Private room near campus",
    shortDescription: "A furnished room with transparent monthly costs.",
    description:
      "A calm private bedroom in a shared apartment near campus and public transport.",
    countryId: id,
    cityId: `${id}city`,
    publicLocationLabel: "Near the main campus",
    locationPrivacy: "APPROXIMATE_AREA",
    monthlyRentMinor: 250_000,
    currency: "cny",
    negotiable: false,
    furnishing: "FURNISHED",
    availablePlaces: 1,
    availableFrom: "2027-01-01",
    smokingPolicy: "NOT_SPECIFIED",
    petPolicy: "NOT_SPECIFIED",
    contactPreference: "KONDO_MESSAGE",
    publicContactEnabled: false,
    amenities: ["WIFI"],
    accuracyConfirmed: true,
  };
}

describe("Housing domain safety", () => {
  it("keeps personal publishing limited to peer-safe listing types", () => {
    expect(canPublishPersonalHousingType("PRIVATE_ROOM")).toBe(true);
    expect(canPublishPersonalHousingType("SUBLET")).toBe(true);
    expect(canPublishPersonalHousingType("ENTIRE_APARTMENT")).toBe(false);
    expect(
      housingListingInputSchema.safeParse({
        ...listingInput(),
        type: "ENTIRE_APARTMENT",
      }).success,
    ).toBe(false);
  });

  it("rejects client-controlled exact public locations for personal listings", () => {
    const result = housingListingInputSchema.safeParse({
      ...listingInput(),
      locationPrivacy: "PUBLIC_EXACT_LOCATION",
      exactLatitude: 30.2741,
      exactLongitude: 120.1551,
    });
    expect(result.success).toBe(false);
  });

  it("creates stable privacy-safe coordinates without returning exact values", () => {
    const exact = { lat: 30.2741, lng: 120.1551 };
    const first = privacySafeHousingCoordinate({
      exact,
      anchor: exact,
      listingId: "listing-one",
      privacy: "APPROXIMATE_AREA",
    });
    const second = privacySafeHousingCoordinate({
      exact,
      anchor: exact,
      listingId: "listing-one",
      privacy: "APPROXIMATE_AREA",
    });
    expect(first).toEqual(second);
    expect(first).not.toEqual(exact);
    expect(
      privacySafeHousingCoordinate({
        exact,
        anchor: exact,
        listingId: "listing-one",
        privacy: "EXACT_AFTER_CONTACT",
      }),
    ).not.toEqual(exact);
    expect(
      privacySafeHousingCoordinate({
        exact,
        anchor: exact,
        listingId: "listing-one",
        privacy: "DISTRICT_ONLY",
      }),
    ).toBeNull();
    expect(
      safeHousingMapPoint({
        publicLatitude: null,
        publicLongitude: null,
        privacy: "DISTRICT_ONLY",
      }),
    ).toBeNull();
  });

  it("centralizes lifecycle transitions and prevents self-approval", () => {
    expect(housingListingTransitions("DRAFT", "PUBLISHER")).toContain(
      "PENDING_REVIEW",
    );
    expect(
      housingListingTransitions("PENDING_REVIEW", "PUBLISHER"),
    ).not.toContain("PUBLISHED");
    expect(() =>
      assertHousingListingTransition({
        from: "PENDING_REVIEW",
        to: "PUBLISHED",
        actor: "PUBLISHER",
      }),
    ).toThrow(/cannot move/i);
    expect(() =>
      assertHousingListingTransition({
        from: "PENDING_REVIEW",
        to: "PUBLISHED",
        actor: "ADMIN",
      }),
    ).not.toThrow();
  });

  it("requires every public visibility predicate to remain valid", () => {
    expect(
      canExposeHousingListingPublicly({
        status: "PUBLISHED",
        publisherType: "PERSONAL",
        publisherUserStatus: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      canExposeHousingListingPublicly({
        status: "PAUSED",
        publisherType: "PERSONAL",
        publisherUserStatus: "ACTIVE",
      }),
    ).toBe(false);
    for (const status of [
      "DRAFT",
      "PAUSED",
      "RENTED",
      "EXPIRED",
      "REJECTED",
      "REMOVED",
      "ARCHIVED",
    ]) {
      expect(
        canExposeHousingListingPublicly({
          status,
          publisherType: "PERSONAL",
          publisherUserStatus: "ACTIVE",
        }),
      ).toBe(false);
    }
    expect(
      canExposeHousingListingPublicly({
        status: "PUBLISHED",
        expiresAt: new Date(Date.now() - 1),
        publisherType: "PERSONAL",
        publisherUserStatus: "ACTIVE",
      }),
    ).toBe(false);
    expect(
      canExposeHousingListingPublicly({
        status: "PUBLISHED",
        publisherType: "ORGANIZATION",
        organizationLifecycleStatus: "SUSPENDED",
        organizationHousingCapability: "ENABLED",
      }),
    ).toBe(false);
    expect(
      canExposeHousingListingPublicly({
        status: "PUBLISHED",
        publisherType: "ORGANIZATION",
        organizationLifecycleStatus: "ACTIVE",
        organizationHousingCapability: "ENABLED",
      }),
    ).toBe(true);
    expect(
      canExposeHousingRequest({
        status: "PUBLISHED",
        visibility: "MEMBERS_ONLY",
        expiresAt: new Date(Date.now() + 60_000),
        authenticated: false,
        owner: false,
      }),
    ).toBe(false);
    expect(
      canExposeRoommateProfile({
        status: "ACTIVE",
        visibility: "MEMBERS_ONLY",
        owner: false,
        authenticated: true,
        blocked: true,
        allowInterests: true,
      }),
    ).toBe(false);
  });

  it("bounds search and roommate inputs", () => {
    expect(
      housingSearchSchema.safeParse({
        types: [],
        amenities: [],
        publisher: "ALL",
        sort: "RELEVANCE",
        limit: 999,
      }).success,
    ).toBe(false);
    expect(
      housingSearchSchema.safeParse({
        types: [],
        amenities: [],
        publisher: "ALL",
        sort: "RELEVANCE",
        minimumRentMinor: 400_000,
        maximumRentMinor: 200_000,
      }).success,
    ).toBe(false);
    expect(
      roommateDiscoverySchema.safeParse({
        languages: [],
        moveInFrom: "2027-06-01",
        moveInTo: "2027-05-01",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid roommate budget ranges", () => {
    expect(
      roommateProfileInputSchema.safeParse({
        active: true,
        visibility: "MEMBERS_ONLY",
        cityId: id,
        moveInDate: "2027-01-01",
        budgetMinimumMinor: 400_000,
        budgetMaximumMinor: 200_000,
        currency: "CNY",
        preferredHousingTypes: ["PRIVATE_ROOM"],
        languages: ["English"],
        smokingPreference: "NOT_SPECIFIED",
        petPreference: "NOT_SPECIFIED",
        introduction:
          "I am a quiet graduate student looking for a respectful roommate.",
        allowInterests: true,
        showUniversity: true,
        showApproximateLocation: true,
      }).success,
    ).toBe(false);
  });

  it("keeps publisher identity explicit and organization-only types controlled", () => {
    expect(
      housingListingInputSchema.safeParse({
        ...listingInput(),
        publisherType: "ORGANIZATION",
        organizationId: null,
      }).success,
    ).toBe(false);
    expect(
      housingListingInputSchema.safeParse({
        ...listingInput(),
        organizationId: `${id}org`,
      }).success,
    ).toBe(false);
  });

  it("does not select private coordinates, addresses or proof media for public DTOs", () => {
    expect(publicHousingListingSelect).not.toHaveProperty("privateAddress");
    expect(publicHousingListingSelect).not.toHaveProperty("exactLatitude");
    expect(publicHousingListingSelect).not.toHaveProperty("exactLongitude");
    expect(
      JSON.stringify(publicHousingListingSelect.media.where),
    ).not.toContain("PROOF_DOCUMENT");
  });

  it("builds search constraints for city, university, price and amenities", () => {
    const parsed = housingSearchSchema.parse({
      cityId: `${id}city`,
      universityId: `${id}university`,
      minimumRentMinor: 100_000,
      maximumRentMinor: 400_000,
      types: ["PRIVATE_ROOM"],
      amenities: ["WIFI", "KITCHEN"],
      publisher: "ALL",
      sort: "RELEVANCE",
    });
    const serialized = JSON.stringify(housingSearchWhere(parsed));
    expect(serialized).toContain(`${id}city`);
    expect(serialized).toContain(`${id}university`);
    expect(serialized).toContain("100000");
    expect(serialized).toContain("400000");
    expect(serialized).toContain("WIFI");
    expect(serialized).toContain("KITCHEN");
    expect(serialized).toContain("PUBLISHED");
  });

  it("keeps organization capability separate from member permission", () => {
    expect(
      hasOrganizationPermission(
        { role: "OWNER", status: "ACTIVE" },
        "ORGANIZATION_MANAGE_HOUSING",
      ),
    ).toBe(true);
    expect(
      hasOrganizationPermission(
        { role: "VIEWER", status: "ACTIVE" },
        "ORGANIZATION_MANAGE_HOUSING",
      ),
    ).toBe(false);
    expect(
      hasOrganizationPermission(
        { role: "OWNER", status: "REMOVED" },
        "ORGANIZATION_MANAGE_HOUSING",
      ),
    ).toBe(false);
  });

  it("uses understandable budget overlap without sensitive attributes", () => {
    expect(
      roommateBudgetsOverlap(
        { minimum: 150_000, maximum: 350_000 },
        { minimum: 300_000, maximum: 500_000 },
      ),
    ).toBe(true);
    expect(
      roommateBudgetsOverlap(
        { minimum: 150_000, maximum: 250_000 },
        { minimum: 300_000, maximum: 500_000 },
      ),
    ).toBe(false);
  });
});
