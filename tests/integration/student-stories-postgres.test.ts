import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decideVerificationRequest,
  publicOfficialProfile,
  submitVerificationRequest,
} from "@/lib/official-profiles";
import { prisma } from "@/lib/prisma";
import {
  addStoryComment,
  createStorySubmission,
  getStoryFeed,
  listStoryComments,
  publishScheduledStories,
  transitionStoryAsAdmin,
  updateStoryInteraction,
} from "@/lib/stories";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "student-stories.test";
const objectPrefix = "student-stories-test/";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length) {
    await prisma.notification.deleteMany({
      where: {
        OR: [{ recipientId: { in: userIds } }, { actorId: { in: userIds } }],
      },
    });
    await prisma.notificationJob.deleteMany({
      where: {
        OR: [{ recipientId: { in: userIds } }, { actorId: { in: userIds } }],
      },
    });
    await prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: { in: userIds } },
          { subjectUserId: { in: userIds } },
        ],
      },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: userIds } },
    });
    await prisma.story.deleteMany({ where: { creatorId: { in: userIds } } });
    await prisma.officialVerificationRequest.deleteMany({
      where: { applicantId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.mediaAsset.deleteMany({
    where: { objectKey: { startsWith: objectPrefix } },
  });
  await prisma.storyCategory.deleteMany({
    where: { slug: { startsWith: "student-stories-test-" } },
  });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [creator, viewer, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: `creator-${suffix}@${testDomain}`,
        username: `storycreator${suffix.slice(0, 8)}`,
        firstName: "Story",
        lastName: "Creator",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `viewer-${suffix}@${testDomain}`,
        username: `storyviewer${suffix.slice(0, 8)}`,
        firstName: "Story",
        lastName: "Viewer",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `admin-${suffix}@${testDomain}`,
        username: `storyadmin${suffix.slice(0, 8)}`,
        firstName: "Story",
        lastName: "Admin",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }),
  ]);
  const category = await prisma.storyCategory.create({
    data: {
      slug: `student-stories-test-${suffix}`,
      name: `Student Stories Test ${suffix}`,
      icon: "🎓",
      order: 9_999,
    },
  });
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  const video = await prisma.mediaAsset.create({
    data: {
      ownerId: creator.id,
      objectKey: `${objectPrefix}${suffix}.mp4`,
      storageProvider: "LOCAL",
      kind: "VIDEO",
      purpose: "STORY_VIDEO",
      visibility: "PUBLIC",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "student-story.mp4",
      extension: "mp4",
      declaredMime: "video/mp4",
      detectedMime: "video/mp4",
      sizeBytes: 2_000_000,
      durationSeconds: 75,
      uploadExpiresAt: expiresAt,
      uploadedAt: new Date(),
      validatedAt: new Date(),
      checksumSha256: "a".repeat(64),
    },
  });
  const document = await prisma.mediaAsset.create({
    data: {
      ownerId: creator.id,
      objectKey: `${objectPrefix}${suffix}.pdf`,
      storageProvider: "LOCAL",
      kind: "DOCUMENT",
      purpose: "VERIFICATION_DOCUMENT",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "authority.pdf",
      extension: "pdf",
      declaredMime: "application/pdf",
      detectedMime: "application/pdf",
      sizeBytes: 250_000,
      uploadExpiresAt: expiresAt,
      uploadedAt: new Date(),
      validatedAt: new Date(),
      checksumSha256: "b".repeat(64),
    },
  });
  return { creator, viewer, admin, category, video, document };
}

postgresDescribe("Student Stories and official profiles on PostgreSQL", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("publishes through moderation and supports feed interactions", async () => {
    const submitted = await createStorySubmission(
      fixture.creator,
      {
        categoryId: fixture.category.id,
        videoMediaId: fixture.video.id,
        title: "How to prepare for a first week in China",
        description:
          "A practical checklist created for newly arrived international students.",
        language: "en",
        captions: "Bring your passport and keep digital copies.",
        entityLinks: [],
      },
      { ipAddress: "127.0.0.1", userAgent: "Vitest" },
    );
    expect(submitted.status).toBe("PENDING_REVIEW");

    await transitionStoryAsAdmin(fixture.admin, submitted.id, {
      status: "APPROVED",
      reason: "The information is clear and safe for publication.",
      qualityScore: 0.9,
      isFeatured: true,
    });
    await transitionStoryAsAdmin(fixture.admin, submitted.id, {
      status: "PUBLISHED",
      reason: "Approved for the Student Stories feed.",
    });

    const feed = await getStoryFeed(fixture.viewer, {
      storySlug: submitted.slug,
      limit: 5,
    });
    expect(feed[0]).toMatchObject({
      id: submitted.id,
      durationSeconds: 75,
      viewer: { liked: false, saved: false },
      creator: { official: false },
    });

    await updateStoryInteraction(fixture.viewer, submitted.id, {
      action: "LIKE",
      active: true,
    });
    await updateStoryInteraction(fixture.viewer, submitted.id, {
      action: "SAVE",
      active: true,
    });
    const comment = await addStoryComment(fixture.viewer, submitted.id, {
      content: "This checklist is immediately useful.",
    });
    const comments = await listStoryComments(fixture.viewer, submitted.id);
    expect(comments.comments[0]).toMatchObject({
      id: comment.id,
      content: "This checklist is immediately useful.",
      viewer: { canDelete: true },
    });

    const updatedFeed = await getStoryFeed(fixture.viewer, {
      storySlug: submitted.slug,
    });
    expect(updatedFeed[0]).toMatchObject({
      viewer: { liked: true, saved: true },
      counts: { likes: 1, saves: 1, comments: 1 },
    });

    await updateStoryInteraction(fixture.viewer, submitted.id, {
      action: "HIDE",
      active: true,
      reason: "Not relevant right now",
    });
    await expect(getStoryFeed(fixture.viewer)).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: submitted.id })]),
    );

    await prisma.story.update({
      where: { id: submitted.id },
      data: {
        status: "SCHEDULED",
        publishedAt: null,
        scheduledAt: new Date("2029-12-31T23:55:00.000Z"),
      },
    });
    await expect(
      publishScheduledStories({
        now: new Date("2030-01-01T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      published: 1,
      storyIds: [submitted.id],
    });
    await expect(
      prisma.story.findUniqueOrThrow({
        where: { id: submitted.id },
        select: { status: true, scheduledAt: true, publishedAt: true },
      }),
    ).resolves.toMatchObject({
      status: "PUBLISHED",
      scheduledAt: null,
      publishedAt: new Date("2030-01-01T00:00:00.000Z"),
    });
  });

  it("keeps verification evidence private and exposes only approved status", async () => {
    const submitted = await submitVerificationRequest(
      fixture.creator,
      {
        organizationType: "UNIVERSITY",
        organizationName: "International Student Office",
        authorityDescription:
          "I am authorized to publish official student guidance for this office.",
        officialWebsite: "https://university.example.edu",
        documents: [
          {
            mediaId: fixture.document.id,
            label: "Authority letter",
          },
        ],
      },
      { ipAddress: "127.0.0.1", userAgent: "Vitest" },
    );
    expect(submitted.status).toBe("SUBMITTED");

    await decideVerificationRequest(fixture.admin, submitted.id, {
      status: "APPROVED",
      reason: "The organization and publishing authority were confirmed.",
      nextReviewAt: new Date("2030-01-01T00:00:00.000Z"),
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.creator.id },
      select: {
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
      },
    });
    expect(publicOfficialProfile(user)).toMatchObject({
      type: "UNIVERSITY",
      organizationName: "International Student Office",
    });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: fixture.document.id },
        select: { visibility: true, attachmentType: true },
      }),
    ).resolves.toEqual({
      visibility: "PRIVATE",
      attachmentType: "OFFICIAL_VERIFICATION",
    });
  });
});
