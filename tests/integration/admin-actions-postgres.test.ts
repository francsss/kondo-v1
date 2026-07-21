import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createGuide,
  deleteGuide,
  deleteGuideStep,
  getAdminGuide,
  GuideError,
  setGuidePublished,
  updateGuide,
  upsertGuideStep,
} from "@/lib/guides";
import { prisma } from "@/lib/prisma";
import {
  ProfileError,
  revokeUserSessionsAsAdmin,
  updateUserStatusAsAdmin,
} from "@/lib/profiles";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module17.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.guideProgress.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.guide.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [admin, superAdmin, moderator, member] = await Promise.all(
    [
      ["admin", "ADMIN"],
      ["superadmin", "SUPER_ADMIN"],
      ["moderator", "MODERATOR"],
      ["member", "MEMBER"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          username: `${label}${suffix.slice(0, 8)}`,
          firstName: label![0]!.toUpperCase() + label!.slice(1),
          lastName: "Admin17",
          role: role as "ADMIN" | "SUPER_ADMIN" | "MODERATOR" | "MEMBER",
          status: "ACTIVE",
        },
      }),
    ),
  );
  return { admin, superAdmin, moderator, member };
}

postgresDescribe("Module 17 PostgreSQL admin actions", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  beforeEach(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("suspends a member, revokes their sessions, and audits the change", async () => {
    await prisma.session.create({
      data: {
        userId: fixture.member.id,
        tokenHash: `session-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const result = await updateUserStatusAsAdmin({
      actor: fixture.admin,
      userId: fixture.member.id,
      status: "SUSPENDED",
      reason: "Repeated marketplace scam reports from multiple buyers.",
    });
    expect(result).toMatchObject({ status: "SUSPENDED", sessionsRevoked: 1 });
    await expect(
      prisma.session.count({ where: { userId: fixture.member.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditLog.count({
        where: { action: "USER_STATUS_UPDATED", entityId: fixture.member.id },
      }),
    ).resolves.toBe(1);
  });

  it("blocks an actor from changing their own status", async () => {
    await expect(
      updateUserStatusAsAdmin({
        actor: fixture.admin,
        userId: fixture.admin.id,
        status: "SUSPENDED",
        reason: "Testing self-lockout prevention behavior.",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("only lets a Super Admin change another Super Admin's status", async () => {
    await expect(
      updateUserStatusAsAdmin({
        actor: fixture.admin,
        userId: fixture.superAdmin.id,
        status: "SUSPENDED",
        reason: "Attempting a privilege-escalation guard test case.",
      }),
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      updateUserStatusAsAdmin({
        actor: fixture.superAdmin,
        userId: fixture.admin.id,
        status: "SUSPENDED",
        reason: "Super Admin exercising legitimate authority here.",
      }),
    ).resolves.toMatchObject({ status: "SUSPENDED" });
  });

  it("revokes sessions independently of a status change", async () => {
    await prisma.session.createMany({
      data: [
        {
          userId: fixture.member.id,
          tokenHash: `session-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          userId: fixture.member.id,
          tokenHash: `session-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
    });
    const result = await revokeUserSessionsAsAdmin({
      actor: fixture.admin,
      userId: fixture.member.id,
    });
    expect(result.sessionsRevoked).toBe(2);
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.member.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "ACTIVE" });
  });

  it("creates, staffs with steps, and publishes a guide, blocking publish with zero steps", async () => {
    const created = await createGuide({
      actor: fixture.admin,
      data: {
        title: "Module 17 arrival checklist",
        summary: "A test guide fixture used to validate the CMS.",
        category: "ARRIVAL",
        estimatedMinutes: 15,
      },
    });
    expect(created.guide.published).toBe(false);

    await expect(
      setGuidePublished({
        actor: fixture.admin,
        guideId: created.guide.id,
        published: true,
      }),
    ).rejects.toMatchObject({ status: 409 });

    const step = await upsertGuideStep({
      actor: fixture.admin,
      guideId: created.guide.id,
      data: {
        order: 0,
        title: "Register with police",
        content: "Visit the local station within 24 hours.",
      },
    });

    const published = await setGuidePublished({
      actor: fixture.admin,
      guideId: created.guide.id,
      published: true,
    });
    expect(published.guide.published).toBe(true);
    expect(published.guide.publishedAt).toBeTruthy();

    await expect(
      deleteGuideStep({
        actor: fixture.admin,
        guideId: created.guide.id,
        stepId: step.step.id,
      }),
    ).resolves.toEqual({ deleted: true });
  });

  it("rejects a duplicate step order and enforces safe deletion rules", async () => {
    const created = await createGuide({
      actor: fixture.admin,
      data: {
        title: "Module 17 banking guide",
        summary: "A second test guide fixture for order-conflict coverage.",
        category: "MONEY",
        estimatedMinutes: 20,
      },
    });
    await upsertGuideStep({
      actor: fixture.admin,
      guideId: created.guide.id,
      data: {
        order: 0,
        title: "Open a bank account",
        content: "Bring your passport and enrollment letter.",
      },
    });
    await expect(
      upsertGuideStep({
        actor: fixture.admin,
        guideId: created.guide.id,
        data: {
          order: 0,
          title: "Duplicate order",
          content: "This should collide on the unique index.",
        },
      }),
    ).rejects.toMatchObject({ status: 409 });

    await setGuidePublished({
      actor: fixture.admin,
      guideId: created.guide.id,
      published: true,
    });
    await expect(
      deleteGuide({ actor: fixture.admin, guideId: created.guide.id }),
    ).rejects.toMatchObject({ status: 409 });

    await setGuidePublished({
      actor: fixture.admin,
      guideId: created.guide.id,
      published: false,
    });
    await expect(
      deleteGuide({ actor: fixture.admin, guideId: created.guide.id }),
    ).resolves.toEqual({ deleted: true });
    await expect(
      getAdminGuide(fixture.admin, created.guide.id),
    ).resolves.toBeNull();
  });

  it("blocks Moderators from the guide CMS and user management", async () => {
    await expect(
      createGuide({
        actor: fixture.moderator,
        data: {
          title: "Should not be created",
          summary: "Moderators cannot manage the guide CMS.",
          category: "HEALTH",
          estimatedMinutes: 5,
        },
      }),
    ).rejects.toBeInstanceOf(GuideError);
    await expect(
      updateUserStatusAsAdmin({
        actor: fixture.moderator,
        userId: fixture.member.id,
        status: "SUSPENDED",
        reason: "Moderators cannot manage account status either.",
      }),
    ).rejects.toBeInstanceOf(ProfileError);
  });

  it("keeps a guide's other fields intact when only some are updated", async () => {
    const created = await createGuide({
      actor: fixture.admin,
      data: {
        title: "Module 17 partial update guide",
        summary: "Initial summary text for the partial-update test.",
        category: "TRANSPORT",
        estimatedMinutes: 8,
      },
    });
    await updateGuide({
      actor: fixture.admin,
      guideId: created.guide.id,
      data: { featured: true },
    });
    const detail = await getAdminGuide(fixture.admin, created.guide.id);
    expect(detail).toMatchObject({
      title: "Module 17 partial update guide",
      featured: true,
      category: "TRANSPORT",
    });
  });

  it("persists, attaches, and removes a validated guide cover", async () => {
    const cover = await prisma.mediaAsset.create({
      data: {
        ownerId: fixture.admin.id,
        objectKey: `guides/${randomUUID()}.jpg`,
        storageProvider: "LOCAL",
        kind: "IMAGE",
        purpose: "GUIDE_COVER",
        visibility: "PUBLIC",
        status: "ACTIVE",
        scanStatus: "CLEAN",
        originalFileName: "guide-cover.jpg",
        extension: "jpg",
        declaredMime: "image/jpeg",
        detectedMime: "image/jpeg",
        sizeBytes: 42_000,
        width: 640,
        height: 320,
        altText: "Arrival guide cover",
        checksumSha256: "a".repeat(64),
        uploadExpiresAt: new Date(Date.now() + 60_000),
        uploadedAt: new Date(),
        validatedAt: new Date(),
      },
    });
    const created = await createGuide({
      actor: fixture.admin,
      data: {
        title: "Module 17 covered guide",
        summary: "A guide used to verify secure cover media persistence.",
        category: "ARRIVAL",
        estimatedMinutes: 12,
        coverMediaId: cover.id,
      },
    });
    await expect(
      getAdminGuide(fixture.admin, created.guide.id),
    ).resolves.toMatchObject({ coverMediaId: cover.id });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: cover.id },
        select: { attachmentType: true, attachmentId: true },
      }),
    ).resolves.toEqual({
      attachmentType: "GUIDE",
      attachmentId: created.guide.id,
    });

    await updateGuide({
      actor: fixture.admin,
      guideId: created.guide.id,
      data: { coverMediaId: null },
    });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: cover.id },
        select: { attachedAt: true, attachmentType: true, attachmentId: true },
      }),
    ).resolves.toEqual({
      attachedAt: null,
      attachmentType: null,
      attachmentId: null,
    });
  });
});
