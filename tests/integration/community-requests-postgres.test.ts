import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeCommunityRequest,
  closeExpiredCommunityRequests,
  createCommunityRequest,
  getCommunityRequestOverview,
  offerCommunityRequestHelp,
} from "@/lib/community-requests";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "community-requests.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [creator, helper, outsider] = await Promise.all([
    prisma.user.create({
      data: {
        email: `creator-${suffix}@${testDomain}`,
        firstName: "Ama",
        lastName: "Creator",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `helper-${suffix}@${testDomain}`,
        firstName: "Kofi",
        lastName: "Helper",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `outsider-${suffix}@${testDomain}`,
        firstName: "Nana",
        lastName: "Outside",
        status: "ACTIVE",
      },
    }),
  ]);
  const community = await prisma.community.create({
    data: {
      slug: `community-requests-${suffix}`,
      name: "Community Requests Test",
      description: "A community used to verify independent request lifecycles.",
      type: "TOPIC",
      createdById: creator.id,
      ownerId: creator.id,
      members: {
        create: [
          { userId: creator.id, role: "OWNER" },
          { userId: helper.id, role: "MEMBER" },
        ],
      },
    },
  });
  return { creator, helper, outsider, community };
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: userIds } },
  });
  await prisma.community.deleteMany({
    where: { createdById: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createRequest(
  overrides: Partial<{
    priority: "URGENT" | "IMPORTANT" | "NORMAL";
    title: string;
  }> = {},
) {
  return createCommunityRequest({
    actor: fixture.creator,
    communityId: fixture.community.id,
    data: {
      category: "DOCUMENTS",
      priority: overrides.priority ?? "NORMAL",
      title: overrides.title ?? "Residence permit translation",
      description:
        "I need help checking one translated field before tomorrow morning.",
      expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
}

postgresDescribe("Community request lifecycle", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("keeps requests separate from posts and exposes urgent community attention", async () => {
    const created = await createRequest({
      priority: "URGENT",
      title: "Urgent document check",
    });
    const overview = await getCommunityRequestOverview({
      communityId: fixture.community.id,
      userId: fixture.creator.id,
      includeLists: true,
    });

    expect(created.request.status).toBe("OPEN");
    expect(overview.urgentCount).toBeGreaterThanOrEqual(1);
    expect(overview.spotlightRequest).toMatchObject({
      id: created.request.id,
      priority: "URGENT",
    });
    expect(overview.communityRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.request.id }),
      ]),
    );
    await expect(
      prisma.post.count({ where: { communityId: fixture.community.id } }),
    ).resolves.toBe(0);
  });

  it("moves to in progress once, immediately notifies the creator, and deduplicates help", async () => {
    const created = await createRequest({ title: "Help moving a desk" });
    await expect(
      offerCommunityRequestHelp({
        actor: fixture.helper,
        requestId: created.request.id,
      }),
    ).resolves.toMatchObject({
      helping: true,
      helpCount: 1,
      status: "IN_PROGRESS",
    });
    await offerCommunityRequestHelp({
      actor: fixture.helper,
      requestId: created.request.id,
    });

    await expect(
      prisma.communityRequest.findUniqueOrThrow({
        where: { id: created.request.id },
        select: { status: true, _count: { select: { helpOffers: true } } },
      }),
    ).resolves.toMatchObject({
      status: "IN_PROGRESS",
      _count: { helpOffers: 1 },
    });
    await expect(
      prisma.notification.findFirst({
        where: {
          recipientId: fixture.creator.id,
          dedupeKey: `community-request-help:${created.request.id}:${fixture.helper.id}`,
        },
      }),
    ).resolves.toMatchObject({
      title: "Kofi Helper can help",
      href: `/communities/${fixture.community.slug}?tab=requests#request-${created.request.id}`,
    });
  });

  it("lets only the creator close and notifies everyone who offered help", async () => {
    const created = await createRequest({ title: "Airport pickup advice" });
    await offerCommunityRequestHelp({
      actor: fixture.helper,
      requestId: created.request.id,
    });
    await expect(
      closeCommunityRequest({
        actor: fixture.helper,
        requestId: created.request.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      closeCommunityRequest({
        actor: fixture.creator,
        requestId: created.request.id,
      }),
    ).resolves.toEqual({ status: "CLOSED" });

    await expect(
      prisma.notification.findFirst({
        where: {
          recipientId: fixture.helper.id,
          dedupeKey: `community-request-closed:${created.request.id}:${fixture.helper.id}`,
        },
      }),
    ).resolves.toMatchObject({
      title: "Community request resolved",
    });
  });

  it("rejects non-members and closes expired requests automatically", async () => {
    const created = await createRequest({ title: "Short lived request" });
    await expect(
      offerCommunityRequestHelp({
        actor: fixture.outsider,
        requestId: created.request.id,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await prisma.communityRequest.update({
      where: { id: created.request.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(closeExpiredCommunityRequests()).resolves.toMatchObject({
      closed: expect.any(Number),
    });
    await expect(
      prisma.communityRequest.findUniqueOrThrow({
        where: { id: created.request.id },
        select: { status: true, closedAt: true },
      }),
    ).resolves.toMatchObject({
      status: "CLOSED",
      closedAt: expect.any(Date),
    });
  });
});
