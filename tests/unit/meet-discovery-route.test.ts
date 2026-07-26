import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findProfile: vi.fn(),
  getCurrentUser: vi.fn(),
  getPremiumAccess: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/premium", () => ({
  getPremiumAccess: mocks.getPremiumAccess,
  hasPremiumFeature: (access: { featureKeys: string[] }, feature: string) =>
    access.featureKeys.includes(feature),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.findMany },
    meetDiscoveryProfile: { findUnique: mocks.findProfile },
  },
}));

import { POST } from "../../app/api/meet/discovery/route";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/meet/discovery", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

const viewerProfile = {
  userId: "viewer-1",
  gender: "FEMALE",
  interestedIn: "ALL",
  birthYear: 2000,
  minimumAge: 18,
  maximumAge: 40,
  preferredLanguages: ["English"],
  lookingFor: ["STUDY", "FRIENDS"],
  distanceRange: "CITY",
  otherCityId: null,
  nearbyVisibility: true,
  showAge: true,
  showNationality: true,
  showUniversity: true,
  showRelationshipStatus: true,
  showLanguages: true,
  showInterests: true,
  completedAt: new Date("2026-07-01T00:00:00.000Z"),
};

describe("Meet discovery API", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "viewer-1",
      cityId: "city-1",
      countryId: "country-1",
      universityId: "university-1",
      gender: "FEMALE",
    });
    mocks.findProfile.mockResolvedValue(viewerProfile);
    mocks.getPremiumAccess.mockResolvedValue({
      active: false,
      status: null,
      planName: null,
      expiresAt: null,
      featureKeys: [],
    });
    mocks.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses same-city opt-in discovery and excludes blocked relationships", async () => {
    const response = await POST(
      request({
        mode: "NEARBY",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        intents: [],
        distanceRange: "CITY",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "viewer-1" },
          cityId: "city-1",
          blockedUsers: { none: { blockedId: "viewer-1" } },
          blockedByUsers: { none: { blockerId: "viewer-1" } },
          meetDiscoveryProfile: {
            is: {
              completedAt: { not: null },
              nearbyVisibility: true,
            },
          },
        }),
      }),
    );
    expect(await response.json()).toEqual(
      expect.objectContaining({
        mode: "NEARBY",
        privacy: "APPROXIMATE_ONLY",
        profiles: [],
      }),
    );
  });

  it("requires a completed discovery profile", async () => {
    mocks.findProfile.mockResolvedValue(null);
    const response = await POST(
      request({
        mode: "LOOKING_FOR",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        intents: ["STUDY"],
        distanceRange: "CITY",
      }),
    );
    expect(response.status).toBe(428);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "MEET_PROFILE_REQUIRED" }),
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("requires a discovery intent without creating a video queue entry", async () => {
    const response = await POST(
      request({
        mode: "LOOKING_FOR",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        intents: [],
        distanceRange: "CITY",
      }),
    );

    expect(response.status).toBe(422);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("never exposes private location or education details", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "member-2",
        username: "member-two",
        firstName: "Ama",
        lastName: "Mensah",
        gender: "FEMALE",
        avatarMediaId: null,
        bio: "Student",
        lastActiveAt: new Date("2026-07-26T10:00:00.000Z"),
        languages: ["English"],
        interests: ["Study"],
        locationAudience: "PRIVATE",
        educationAudience: "PRIVATE",
        languagesAudience: "MEMBERS",
        officialProfileStatus: "NOT_VERIFIED",
        officialOrganizationType: null,
        officialOrganizationName: null,
        officialVerifiedAt: null,
        country: { name: "Ghana", emoji: "🇬🇭" },
        city: { name: "Jiaxing" },
        university: {
          id: "university-1",
          name: "Jiaxing University",
          shortName: "JXU",
        },
        meetDiscoveryProfile: {
          ...viewerProfile,
          userId: "member-2",
          interestedIn: "ALL",
          lookingFor: ["STUDY"],
          nearbyVisibility: true,
        },
      },
    ]);

    const response = await POST(
      request({
        mode: "LOOKING_FOR",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        intents: ["STUDY"],
        distanceRange: "CITY",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profiles[0].location).toBeNull();
    expect(payload.profiles[0].university).toBeNull();
    expect(payload.profiles[0]).not.toHaveProperty("meetIntents");
  });

  it("gates extended distance without activating a fake subscription", async () => {
    const response = await POST(
      request({
        mode: "NEARBY",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        intents: [],
        distanceRange: "KM_20",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(
      expect.objectContaining({ code: "MEET_PREMIUM_REQUIRED" }),
    );
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
});
