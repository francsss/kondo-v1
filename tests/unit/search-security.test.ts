import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFindMany: vi.fn(),
  guideFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  postFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  userFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: { findMany: mocks.communityFindMany },
    guide: { findMany: mocks.guideFindMany },
    marketplaceListing: { findMany: mocks.listingFindMany },
    post: { findMany: mocks.postFindMany },
    question: { findMany: mocks.questionFindMany },
    user: { findMany: mocks.userFindMany },
    $queryRaw: mocks.queryRaw,
  },
}));

// Full-text ranking runs before each model's findMany; resolve one ranked-ID
// batch per category in the same order searchKondo issues them.
function mockRankedIds(idsByCategory: string[][]) {
  for (const ids of idsByCategory) {
    mocks.queryRaw.mockImplementationOnce(async () =>
      ids.map((id, index) => ({ id, rank: 1 - index * 0.01 })),
    );
  }
}

describe("search result minimization", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns explicit DTOs without private or internal user fields", async () => {
    mocks.communityFindMany.mockResolvedValue([
      {
        id: "community-1",
        slug: "public-community",
        name: "Public Community",
        icon: "🌍",
        _count: { members: 12 },
      },
    ]);
    mocks.listingFindMany.mockResolvedValue([
      {
        id: "listing-1",
        slug: "bike",
        title: "Bike",
        priceFen: 10000,
        city: { name: "Jiaxing" },
      },
    ]);
    mocks.guideFindMany.mockResolvedValue([]);
    mocks.questionFindMany.mockResolvedValue([
      {
        id: "question-1",
        slug: "visa",
        title: "Visa",
        _count: { answers: 2 },
      },
    ]);
    mocks.userFindMany.mockResolvedValue([
      {
        id: "user-1",
        username: "ama",
        firstName: "Ama",
        lastName: "Mensah",
        email: "private@example.com",
        phone: "private",
        role: "ADMIN",
        status: "ACTIVE",
        passwordHash: "private",
        country: { emoji: "🇬🇭" },
        university: { shortName: "JXU" },
        degree: "Engineering",
      },
    ]);
    mocks.postFindMany.mockResolvedValue([
      {
        id: "post-1",
        title: "Hello",
        content: "Community post",
        community: { slug: "public-community", name: "Public Community" },
        author: {
          id: "user-1",
          username: "ama",
          firstName: "Ama",
          lastName: "Mensah",
          email: "private@example.com",
          role: "ADMIN",
        },
      },
    ]);

    mockRankedIds([
      ["community-1"],
      ["listing-1"],
      [],
      ["question-1"],
      ["user-1"],
      ["post-1"],
    ]);
    const { searchKondo } = await import("@/lib/search");
    const result = await searchKondo("jia", "viewer-1");

    expect(result.users[0]).toEqual({
      id: "user-1",
      username: "ama",
      firstName: "Ama",
      lastName: "Mensah",
      officialProfileStatus: "NOT_VERIFIED",
      officialOrganizationType: null,
      officialOrganizationName: null,
      officialVerifiedAt: null,
      countryEmoji: "🇬🇭",
      affiliation: "JXU",
    });
    expect(result.posts[0]?.author).toEqual({
      id: "user-1",
      username: "ama",
      firstName: "Ama",
      lastName: "Mensah",
      officialProfileStatus: "NOT_VERIFIED",
      officialOrganizationType: null,
      officialOrganizationName: null,
      officialVerifiedAt: null,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(JSON.stringify(result)).not.toContain('"role"');
    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "ACTIVE" }),
        select: expect.objectContaining({
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        }),
      }),
    );
    expect(mocks.communityFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              AND: [
                { status: { not: "REMOVED" } },
                {
                  OR: [
                    { status: "ACTIVE", isPrivate: false },
                    { members: { some: { userId: "viewer-1" } } },
                    {
                      accessRequests: {
                        some: {
                          userId: "viewer-1",
                          type: "INVITATION",
                          status: "PENDING",
                        },
                      },
                    },
                  ],
                },
              ],
            },
            expect.any(Object),
          ],
        },
      }),
    );
    expect(mocks.postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              status: "PUBLISHED",
              community: {
                AND: [
                  { status: { not: "REMOVED" } },
                  {
                    OR: [
                      { status: "ACTIVE", isPrivate: false },
                      { members: { some: { userId: "viewer-1" } } },
                      {
                        accessRequests: {
                          some: {
                            userId: "viewer-1",
                            type: "INVITATION",
                            status: "PENDING",
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            },
            { author: { status: "ACTIVE" } },
            expect.any(Object),
          ],
        },
      }),
    );
  });
});
