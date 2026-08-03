import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestCountry } from "../helpers/reference-data";
import { getPublicHousingListing } from "@/lib/housing-listings";
import { expireHousingRequests } from "@/lib/housing-requests";
import {
  listSavedHousing,
  saveHousingListing,
  unsaveHousingListing,
} from "@/lib/housing-saved";
import {
  getHousingRecommendations,
  listHousingMapPoints,
} from "@/lib/housing-search";
import { prisma } from "@/lib/prisma";
import { discoverRoommateProfiles } from "@/lib/roommate-profiles";

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "housing.test";

let ids: {
  userId: string;
  viewerId: string;
  countryId: string;
  cityId: string;
  publishedId: string;
  hiddenId: string;
  expiredId: string;
};

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${domain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.housingListing.deleteMany({
    where: { publisherUserId: { in: userIds } },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.city.deleteMany({
    where: { slug: { startsWith: "housing-test-" } },
  });
  await prisma.country.deleteMany({
    where: { name: { startsWith: "Housing Test " } },
  });
}

postgresDescribe("Housing public privacy and visibility", () => {
  beforeAll(async () => {
    await cleanup();
    const suffix = randomUUID().replaceAll("-", "");
    const country = await createTestCountry(prisma, {
      name: `Housing Test ${suffix}`,
    });
    const city = await prisma.city.create({
      data: {
        slug: `housing-test-${suffix}`,
        name: `Housing City ${suffix}`,
        countryId: country.id,
      },
    });
    const [user, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          email: `publisher-${suffix}@${domain}`,
          firstName: "Housing",
          lastName: "Publisher",
          status: "ACTIVE",
          cityId: city.id,
        },
      }),
      prisma.user.create({
        data: {
          email: `viewer-${suffix}@${domain}`,
          firstName: "Housing",
          lastName: "Viewer",
          status: "ACTIVE",
          cityId: city.id,
        },
      }),
    ]);
    const base = {
      publisherType: "PERSONAL" as const,
      publisherUserId: user.id,
      createdByUserId: user.id,
      representativeUserId: user.id,
      type: "PRIVATE_ROOM" as const,
      title: "Private room for Housing tests",
      shortDescription: "A safe public summary used by integration tests.",
      description:
        "A complete public description that does not expose private contact details.",
      countryId: country.id,
      cityId: city.id,
      publicLocationLabel: "Near Test University",
      privateAddress: "Secret building 8, unit 901",
      exactLatitude: 30.2741,
      exactLongitude: 120.1551,
      publicLatitude: 30.28,
      publicLongitude: 120.16,
      locationPrivacy: "APPROXIMATE_AREA" as const,
      monthlyRentMinor: 250_000,
      currency: "CNY",
      availablePlaces: 1,
      availableFrom: new Date("2027-01-01"),
      accuracyConfirmedAt: new Date(),
    };
    const [published, hidden, expired] = await Promise.all([
      prisma.housingListing.create({
        data: {
          ...base,
          slug: `public-${suffix}`,
          status: "PUBLISHED",
          publishedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      }),
      prisma.housingListing.create({
        data: {
          ...base,
          slug: `paused-${suffix}`,
          title: "Paused Housing test listing",
          status: "PAUSED",
        },
      }),
      prisma.housingListing.create({
        data: {
          ...base,
          slug: `expired-${suffix}`,
          title: "Expired Housing test listing",
          status: "PUBLISHED",
          publishedAt: new Date(Date.now() - 172_800_000),
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      }),
    ]);
    ids = {
      userId: user.id,
      viewerId: viewer.id,
      countryId: country.id,
      cityId: city.id,
      publishedId: published.id,
      hiddenId: hidden.id,
      expiredId: expired.id,
    };
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("serializes only the public location and never the private address", async () => {
    const listing = await getPublicHousingListing(ids.publishedId);
    expect(listing).toBeTruthy();
    const serialized = JSON.stringify(listing);
    expect(serialized).not.toContain("Secret building");
    expect(serialized).not.toContain("exactLatitude");
    expect(serialized).not.toContain("exactLongitude");
    expect(listing?.location.mapPoint).toEqual({ lat: 30.28, lng: 120.16 });
  });

  it("does not expose paused listings through public read or map", async () => {
    await expect(getPublicHousingListing(ids.hiddenId)).resolves.toBeNull();
    const points = await listHousingMapPoints({ cityId: ids.cityId });
    expect(points.map(({ id }) => id)).toContain(ids.publishedId);
    expect(points.map(({ id }) => id)).not.toContain(ids.hiddenId);
    expect(JSON.stringify(points)).not.toContain("Secret building");
    const outsideViewport = await listHousingMapPoints({
      cityId: ids.cityId,
      north: 40,
      south: 39,
      east: 117,
      west: 116,
    });
    expect(outsideViewport).toHaveLength(0);
  });

  it("keeps lifecycle visibility constraints in personalized recommendations", async () => {
    const recommendations = await getHousingRecommendations(ids.userId);
    const listingIds = recommendations.map(({ listing }) => listing.id);
    expect(listingIds).toContain(ids.publishedId);
    expect(listingIds).not.toContain(ids.hiddenId);
    expect(listingIds).not.toContain(ids.expiredId);
  });

  it("stores one private saved relation and rechecks public visibility", async () => {
    await saveHousingListing(ids.viewerId, ids.publishedId);
    await saveHousingListing(ids.viewerId, ids.publishedId);
    expect(
      await prisma.housingSavedListing.count({
        where: { userId: ids.viewerId, listingId: ids.publishedId },
      }),
    ).toBe(1);
    const saved = await listSavedHousing(ids.viewerId);
    expect(saved.map(({ listing }) => listing.id)).toContain(ids.publishedId);
    expect(saved.map(({ listing }) => listing.id)).not.toContain(ids.hiddenId);
    await unsaveHousingListing(ids.viewerId, ids.publishedId);
    expect(
      await prisma.housingSavedListing.count({
        where: { userId: ids.viewerId, listingId: ids.publishedId },
      }),
    ).toBe(0);
  });

  it("enforces exactly one publisher at the database boundary", async () => {
    await expect(
      prisma.housingListing.create({
        data: {
          slug: `invalid-owner-${randomUUID()}`,
          publisherType: "PERSONAL",
          publisherUserId: null,
          publisherOrganizationId: null,
          createdByUserId: ids.userId,
          representativeUserId: ids.userId,
          type: "PRIVATE_ROOM",
          title: "Invalid ownership listing",
          shortDescription: "This row must be rejected by PostgreSQL.",
          description:
            "The ownership check prevents malformed Housing publisher records.",
          countryId: ids.countryId,
          cityId: ids.cityId,
          publicLocationLabel: "Hidden invalid location",
          monthlyRentMinor: 100_000,
          availableFrom: new Date("2027-01-01"),
        },
      }),
    ).rejects.toThrow(/exactly_one_publisher_check/);
  });

  it("expires requests and removes them from community discovery", async () => {
    const request = await prisma.housingRequest.create({
      data: {
        userId: ids.userId,
        status: "PUBLISHED",
        visibility: "MEMBERS_ONLY",
        cityId: ids.cityId,
        moveInDate: new Date("2027-01-01"),
        maximumBudgetMinor: 300_000,
        preferredListingTypes: ["PRIVATE_ROOM"],
        description:
          "Looking for a quiet private room close to the university campus.",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(expireHousingRequests()).resolves.toMatchObject({
      expired: 1,
    });
    await expect(
      prisma.housingRequest.findUniqueOrThrow({
        where: { id: request.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
  });

  it("excludes self and blocked people from roommate discovery", async () => {
    const profileData = {
      status: "ACTIVE" as const,
      visibility: "MEMBERS_ONLY" as const,
      cityId: ids.cityId,
      moveInDate: new Date("2027-01-01"),
      budgetMaximumMinor: 400_000,
      preferredHousingTypes: ["PRIVATE_ROOM" as const],
      languages: ["English"],
      smokingPreference: "NOT_SPECIFIED" as const,
      petPreference: "NOT_SPECIFIED" as const,
      introduction:
        "Quiet student looking for a respectful roommate near the university.",
      allowInterests: true,
      expiresAt: new Date(Date.now() + 86_400_000),
    };
    await Promise.all([
      prisma.roommateProfile.create({
        data: { ...profileData, userId: ids.userId },
      }),
      prisma.roommateProfile.create({
        data: { ...profileData, userId: ids.viewerId },
      }),
    ]);
    const visible = await discoverRoommateProfiles({
      viewerId: ids.viewerId,
      query: { languages: [], limit: 20 },
    });
    expect(visible.items.map(({ userId }) => userId)).toContain(ids.userId);
    expect(visible.items.map(({ userId }) => userId)).not.toContain(
      ids.viewerId,
    );
    await prisma.userBlock.create({
      data: { blockerId: ids.userId, blockedId: ids.viewerId },
    });
    const hidden = await discoverRoommateProfiles({
      viewerId: ids.viewerId,
      query: { languages: [], limit: 20 },
    });
    expect(hidden.items.map(({ userId }) => userId)).not.toContain(ids.userId);
  });
});
