import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findCity: vi.fn(),
  updateUser: vi.fn(),
  upsertProfile: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    city: { findFirst: mocks.findCity },
    $transaction: vi.fn(
      async (
        callback: (tx: {
          user: { update: typeof mocks.updateUser };
          meetDiscoveryProfile: { upsert: typeof mocks.upsertProfile };
        }) => unknown,
      ) =>
        callback({
          user: { update: mocks.updateUser },
          meetDiscoveryProfile: { upsert: mocks.upsertProfile },
        }),
    ),
  },
}));

import { PUT } from "../../app/api/meet/profile/route";

function request(body: unknown) {
  return new NextRequest("http://localhost:3000/api/meet/profile", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      host: "localhost:3000",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

const completeProfile = {
  gender: "FEMALE",
  interestedIn: "ALL",
  birthYear: 2000,
  minimumAge: 18,
  maximumAge: 40,
  preferredLanguages: ["English", "French"],
  lookingFor: [
    "FRIENDS",
    "STUDY",
    "LANGUAGE",
    "SPORTS",
    "CITY",
    "NETWORKING",
    "COUNTRY",
    "RELATIONSHIP",
  ],
  distanceRange: "CITY",
  otherCityId: null,
  nearbyVisibility: true,
  showAge: true,
  showNationality: true,
  showUniversity: true,
  showRelationshipStatus: true,
  showLanguages: true,
  showInterests: true,
};

describe("Meet discovery profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: "user-1" });
    mocks.updateUser.mockResolvedValue({});
    mocks.upsertProfile.mockResolvedValue({
      userId: "user-1",
      ...completeProfile,
      completedAt: new Date(),
    });
  });

  it("persists all-enabled defaults and synchronizes matching fields", async () => {
    const response = await PUT(request(completeProfile));
    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        gender: "FEMALE",
        nearbyDiscoveryEnabled: true,
        meetIntents: { set: completeProfile.lookingFor },
      },
    });
    expect(mocks.upsertProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          nearbyVisibility: true,
          showAge: true,
          showNationality: true,
          showUniversity: true,
          showLanguages: true,
          showInterests: true,
        }),
      }),
    );
  });

  it("rejects an inverted age range before writing", async () => {
    const response = await PUT(
      request({ ...completeProfile, minimumAge: 40, maximumAge: 18 }),
    );
    expect(response.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
