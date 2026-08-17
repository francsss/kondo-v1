import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findManyUsers: vi.fn(),
  findManyMemberships: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.findManyUsers },
    communityMember: { findMany: mocks.findManyMemberships },
  },
}));

import { getNearbyStudents, NEARBY_PAGE_SIZE } from "@/lib/nearby-students";

// Tsinghua's published location; candidates sit at Peking's, ~2 km away.
const viewer = {
  id: "viewer-1",
  cityId: "city-jiaxing",
  universityId: "uni-jiaxing",
  degree: "Computer Science",
  point: { latitude: 40.0, longitude: 116.3264 },
};

function candidate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    username: "user1",
    firstName: "Ada",
    lastName: "Nwosu",
    avatarMediaId: null,
    degree: "Business",
    cityId: "city-jiaxing",
    universityId: "uni-other",
    lastActiveAt: new Date("2026-08-01T00:00:00Z"),
    locationAudience: "MEMBERS",
    educationAudience: "MEMBERS",
    university: {
      name: "Peking University",
      shortName: "PKU",
      latitude: 39.999,
      longitude: 116.3059,
    },
    city: { latitude: 39.9042, longitude: 116.4074 },
    communityMemberships: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findManyMemberships.mockResolvedValue([{ communityId: "c-1" }]);
});

describe("Nearby ranking", () => {
  it("puts the same university above a closer-sounding stranger", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({ id: "stranger", universityId: "uni-other" }),
      candidate({ id: "classmate", universityId: "uni-jiaxing" }),
    ]);

    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students.map((student) => student.id)).toEqual([
      "classmate",
      "stranger",
    ]);
  });

  it("ranks shared communities above a shared field of study", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({ id: "same-field", degree: "Computer Science" }),
      candidate({
        id: "shared-communities",
        communityMemberships: [{ communityId: "c-1" }, { communityId: "c-2" }],
      }),
    ]);

    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students[0]?.id).toBe("shared-communities");
    expect(students[0]?.reason).toBe("2 communities in common");
    expect(students[1]?.reason).toBe("Same field of study");
  });

  it("never repeats the leading label in the relevance reason", async () => {
    /*
     * The row shows `distance ?? proximity` first, then the reason. The
     * invariant is that the two never say the same thing — not that any
     * particular reason is suppressed.
     */
    mocks.findManyUsers.mockResolvedValue([
      // Same campus, so a distance is available and leads the line.
      candidate({
        id: "classmate",
        universityId: "uni-jiaxing",
        university: {
          name: "Tsinghua University",
          shortName: "THU",
          latitude: 40.0,
          longitude: 116.3264,
        },
      }),
      // Same campus but location private, so "Same campus" leads instead.
      candidate({
        id: "private-classmate",
        universityId: "uni-jiaxing",
        locationAudience: "PRIVATE",
      }),
    ]);

    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    for (const student of students) {
      const leading = student.distance ?? student.proximity;
      expect(student.reason).not.toBe(leading);
    }

    const withDistance = students.find((s) => s.id === "classmate");
    const withoutDistance = students.find((s) => s.id === "private-classmate");
    // A distance frees the reason to carry the university instead.
    expect(withDistance?.distance).toBe("< 1 km away");
    expect(withDistance?.reason).toBe("Same university");
    // Without one, "Same campus" leads and the reason must not echo it.
    expect(withoutDistance?.proximity).toBeNull();
  });

  it("is deterministic when scores tie", async () => {
    const tied = [
      candidate({ id: "b-user" }),
      candidate({ id: "a-user" }),
      candidate({ id: "c-user" }),
    ];
    mocks.findManyUsers.mockResolvedValue(tied);
    const first = await getNearbyStudents({ viewer, filter: "ALL" });
    mocks.findManyUsers.mockResolvedValue([...tied].reverse());
    const second = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(first.students.map((s) => s.id)).toEqual(
      second.students.map((s) => s.id),
    );
  });
});

describe("Nearby privacy", () => {
  it("asks the database only for discoverable, unblocked, active students", async () => {
    mocks.findManyUsers.mockResolvedValue([]);
    await getNearbyStudents({ viewer, filter: "ALL" });

    const where = mocks.findManyUsers.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "viewer-1" });
    expect(where.status).toBe("ACTIVE");
    expect(where.nearbyDiscoveryEnabled).toBe(true);
    expect(where.profileAudience).toEqual({ in: ["PUBLIC", "MEMBERS"] });
    expect(where.onboardingCompletedAt).toEqual({ not: null });
    expect(where.blockedUsers).toEqual({ none: { blockedId: "viewer-1" } });
    expect(where.blockedByUsers).toEqual({ none: { blockerId: "viewer-1" } });
  });

  it("never selects or returns coordinates, age or gender", async () => {
    mocks.findManyUsers.mockResolvedValue([candidate()]);
    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    const select = mocks.findManyUsers.mock.calls[0][0].select;
    for (const field of ["gender", "birthYear", "latitude", "longitude"]) {
      expect(select).not.toHaveProperty(field);
    }
    expect(Object.keys(students[0] ?? {})).toEqual([
      "id",
      "username",
      "firstName",
      "lastName",
      "avatarMediaId",
      "headline",
      "distance",
      "proximity",
      "reason",
    ]);
  });

  it("reports a rounded kilometre distance, never a precise one", async () => {
    mocks.findManyUsers.mockResolvedValue([candidate({ id: "b" })]);
    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    // Tsinghua to Peking is roughly two kilometres.
    expect(students[0]?.distance).toBe("2 km away");
    // No decimals, and no metre-level precision that would locate a person.
    expect(students[0]?.distance).not.toMatch(/\./);
    expect(students[0]?.distance).not.toMatch(/\bm\b/);
  });

  it("calls anything under a kilometre away rather than naming metres", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({
        id: "same-campus",
        universityId: "uni-jiaxing",
        university: {
          name: "Tsinghua University",
          shortName: "THU",
          latitude: 40.0,
          longitude: 116.3264,
        },
      }),
    ]);
    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students[0]?.distance).toBe("< 1 km away");
  });

  it("shows no distance when the places have no coordinates", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({
        id: "unmapped",
        university: {
          name: "Somewhere",
          shortName: null,
          latitude: null,
          longitude: null,
        },
        city: { latitude: null, longitude: null },
      }),
    ]);
    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students[0]?.distance).toBeNull();
    expect(students[0]?.proximity).toBe("Same city");
  });

  it("gives no distance to a student who keeps their location private", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({ id: "private", locationAudience: "PRIVATE" }),
    ]);
    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students[0]?.distance).toBeNull();
    expect(students[0]?.proximity).toBeNull();
  });

  it("hides education and location for students who made them private", async () => {
    mocks.findManyUsers.mockResolvedValue([
      candidate({
        educationAudience: "PRIVATE",
        locationAudience: "PRIVATE",
        universityId: "uni-jiaxing",
      }),
    ]);

    const { students } = await getNearbyStudents({ viewer, filter: "ALL" });

    expect(students[0]?.headline).toBeNull();
    expect(students[0]?.proximity).toBeNull();
  });

  it("returns nothing when the viewer has no study location", async () => {
    const result = await getNearbyStudents({
      viewer: { id: "v", cityId: null, universityId: null, degree: null },
      filter: "ALL",
    });

    expect(result.students).toEqual([]);
    expect(mocks.findManyUsers).not.toHaveBeenCalled();
  });
});

describe("Nearby paging", () => {
  it("pages without repeating anyone", async () => {
    const many = Array.from({ length: NEARBY_PAGE_SIZE * 2 }, (_, index) =>
      candidate({ id: `user-${String(index).padStart(2, "0")}` }),
    );
    mocks.findManyUsers.mockResolvedValue(many);

    const first = await getNearbyStudents({ viewer, filter: "ALL" });
    expect(first.students).toHaveLength(NEARBY_PAGE_SIZE);
    expect(first.nextCursor).toBe(first.students.at(-1)?.id);

    const second = await getNearbyStudents({
      viewer,
      filter: "ALL",
      cursor: first.nextCursor,
    });

    const ids = [...first.students, ...second.students].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.nextCursor).toBeNull();
  });

  it("ends the list when the cursor no longer exists", async () => {
    mocks.findManyUsers.mockResolvedValue([candidate({ id: "only" })]);

    const result = await getNearbyStudents({
      viewer,
      filter: "ALL",
      cursor: "someone-who-left",
    });

    expect(result.students).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe("Nearby filters", () => {
  it("narrows to the viewer's university without widening the city", async () => {
    mocks.findManyUsers.mockResolvedValue([]);
    await getNearbyStudents({ viewer, filter: "UNIVERSITY" });

    expect(mocks.findManyUsers.mock.calls[0][0].where.universityId).toBe(
      "uni-jiaxing",
    );
  });

  it("scopes to the viewer's city by default", async () => {
    mocks.findManyUsers.mockResolvedValue([]);
    await getNearbyStudents({ viewer, filter: "CITY" });

    expect(mocks.findManyUsers.mock.calls[0][0].where.cityId).toBe(
      "city-jiaxing",
    );
  });
});
