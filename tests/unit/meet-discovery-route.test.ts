import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getCurrentUser: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: mocks.findMany,
      update: mocks.update,
    },
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

describe("Meet discovery API", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({
      id: "viewer-1",
      cityId: "city-1",
    });
    mocks.update.mockResolvedValue({});
    mocks.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("uses same-city opt-in discovery and excludes blocked relationships", async () => {
    const response = await POST(
      request({
        mode: "NEARBY",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        nearbyEnabled: true,
        intents: [],
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "viewer-1" },
      data: { nearbyDiscoveryEnabled: true },
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "viewer-1" },
          cityId: "city-1",
          nearbyDiscoveryEnabled: true,
          blockedUsers: { none: { blockedId: "viewer-1" } },
          blockedByUsers: { none: { blockerId: "viewer-1" } },
        }),
      }),
    );
    expect(await response.json()).toEqual({
      mode: "NEARBY",
      privacy: "APPROXIMATE_ONLY",
      profiles: [],
    });
  });

  it("requires a discovery intent without creating a video queue entry", async () => {
    const response = await POST(
      request({
        mode: "LOOKING_FOR",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        nearbyEnabled: false,
        intents: [],
      }),
    );

    expect(response.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("never exposes private location or education details", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "member-2",
        username: "member-two",
        firstName: "Ama",
        lastName: "Mensah",
        avatarMediaId: null,
        bio: "Student",
        lastActiveAt: new Date("2026-07-26T10:00:00.000Z"),
        locationAudience: "PRIVATE",
        educationAudience: "PRIVATE",
        officialProfileStatus: "NOT_VERIFIED",
        officialOrganizationType: null,
        officialOrganizationName: null,
        officialVerifiedAt: null,
        country: { name: "Ghana", emoji: "🇬🇭" },
        city: { name: "Jiaxing" },
        university: { name: "Jiaxing University", shortName: "JXU" },
      },
    ]);

    const response = await POST(
      request({
        mode: "LOOKING_FOR",
        genderPreference: "ALL",
        countryPreferenceCode: "",
        nearbyEnabled: false,
        intents: ["STUDY"],
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profiles[0].location).toBeNull();
    expect(payload.profiles[0].university).toBeNull();
    expect(payload.profiles[0]).not.toHaveProperty("meetIntents");
  });
});
