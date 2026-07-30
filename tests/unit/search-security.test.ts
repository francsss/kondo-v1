import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  communityFindMany: vi.fn(),
  countryFindMany: vi.fn(),
  cityFindMany: vi.fn(),
  guideFindMany: vi.fn(),
  listingFindMany: vi.fn(),
  organizationFindMany: vi.fn(),
  postFindMany: vi.fn(),
  questionFindMany: vi.fn(),
  userFindMany: vi.fn(),
  universityFindMany: vi.fn(),
  scholarshipFindMany: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    community: { findMany: mocks.communityFindMany },
    country: { findMany: mocks.countryFindMany },
    city: { findMany: mocks.cityFindMany },
    guide: { findMany: mocks.guideFindMany },
    marketplaceListing: { findMany: mocks.listingFindMany },
    organization: { findMany: mocks.organizationFindMany },
    post: { findMany: mocks.postFindMany },
    question: { findMany: mocks.questionFindMany },
    user: { findMany: mocks.userFindMany },
    university: { findMany: mocks.universityFindMany },
    scholarship: { findMany: mocks.scholarshipFindMany },
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
    mocks.countryFindMany.mockResolvedValue([]);
    mocks.cityFindMany.mockResolvedValue([]);
    mocks.universityFindMany.mockResolvedValue([]);
    mocks.scholarshipFindMany.mockResolvedValue([]);
    mocks.organizationFindMany.mockResolvedValue([
      {
        id: "organization-1",
        slug: "public-organization",
        publicName: "Public Organization",
        legalName: "Private Legal Name",
        professionalEmail: "private-organization@example.com",
        type: "SERVICE_PROVIDER",
        shortDescription: "A safe public description.",
        verificationStatus: "VERIFIED",
        isOfficialPartner: false,
        city: { name: "Jiaxing" },
        country: { name: "China" },
      },
    ]);
    mocks.communityFindMany.mockResolvedValue([
      {
        id: "community-1",
        slug: "public-community",
        name: "Public Community",
        icon: "🌍",
        isOfficial: false,
        isVerified: false,
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
      ["organization-1"],
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
    expect(result.organizations[0]).toEqual({
      id: "organization-1",
      slug: "public-organization",
      name: "Public Organization",
      organizationType: "SERVICE_PROVIDER",
      organizationTypeLabel: "Service provider",
      shortDescription: "A safe public description.",
      cityName: "Jiaxing",
      countryName: "China",
      verificationState: "VERIFIED",
      partner: false,
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(JSON.stringify(result)).not.toContain('"role"');
    expect(JSON.stringify(result)).not.toContain("Private Legal Name");
    expect(JSON.stringify(result)).not.toContain(
      "private-organization@example.com",
    );
    expect(mocks.organizationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: "ACTIVE",
          publicProfileStatus: "PUBLISHED",
          publicProfileBlockedAt: null,
        }),
        select: expect.not.objectContaining({
          legalName: true,
          professionalEmail: true,
        }),
      }),
    );
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
