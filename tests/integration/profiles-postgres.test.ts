import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  completeMediaUpload,
  createMediaUploadIntent,
  getMediaForDelivery,
  receiveLocalMediaUpload,
} from "@/lib/media";
import { getReportDetail } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";
import {
  cancelAccountRequest,
  createAccountRequest,
  createOrReuseProfileReport,
  getAdminUser,
  getPublicProfile,
  getSavedContent,
  listAdminUsers,
  ProfileError,
  transitionAccountRequest,
  updateProfile,
  updateUserRoleAsAdmin,
} from "@/lib/profiles";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module6.test";
const prefix = "Module6";
const storageRoot = resolve(".data/test-media-module6");

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const media = await prisma.mediaAsset.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const reports = await prisma.report.findMany({
    where: {
      OR: [{ reporterId: { in: userIds } }, { subjectUserId: { in: userIds } }],
    },
    select: { id: true },
  });
  const requests = await prisma.accountRequest.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        {
          entityType: "MediaAsset",
          entityId: { in: media.map(({ id }) => id) },
        },
        {
          entityType: "Report",
          entityId: { in: reports.map(({ id }) => id) },
        },
        {
          entityType: "AccountRequest",
          entityId: { in: requests.map(({ id }) => id) },
        },
      ],
    },
  });
  await prisma.report.deleteMany({
    where: { id: { in: reports.map(({ id }) => id) } },
  });
  await prisma.accountRequest.deleteMany({
    where: { id: { in: requests.map(({ id }) => id) } },
  });
  await prisma.bookmark.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.guide.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.question.deleteMany({ where: { authorId: { in: userIds } } });
  await prisma.marketplaceListing.deleteMany({
    where: { sellerId: { in: userIds } },
  });
  await prisma.community.deleteMany({
    where: { createdById: { in: userIds } },
  });
  await prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { avatarMediaId: null },
  });
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: media.map(({ id }) => id) } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.marketplaceCategory.deleteMany({
    where: { name: { startsWith: prefix } },
  });
  await prisma.city.deleteMany({ where: { name: { startsWith: prefix } } });
  await prisma.country.deleteMany({
    where: { name: { startsWith: prefix } },
  });
  await rm(storageRoot, { force: true, recursive: true });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const country = await prisma.country.create({
    data: {
      code: `M${Math.floor(Math.random() * 10)}`,
      name: `${prefix} Country ${suffix}`,
      isActive: true,
      verified: true,
    },
  });
  const city = await prisma.city.create({
    data: {
      slug: `module6-city-${suffix}`,
      name: `${prefix} City ${suffix}`,
      countryId: country.id,
      isActive: true,
      verified: true,
    },
  });
  const subject = await prisma.user.create({
    data: {
      email: `subject-${suffix}@${testDomain}`,
      firstName: "Module6",
      lastName: "Subject",
      username: `module6.subject.${suffix.slice(0, 8)}`,
      bio: "International student profile used by Module 6 tests.",
      role: "MEMBER",
      status: "ACTIVE",
      countryId: country.id,
      cityId: city.id,
      profileAudience: "PUBLIC",
    },
  });
  const viewer = await prisma.user.create({
    data: {
      email: `viewer-${suffix}@${testDomain}`,
      firstName: "Module6",
      lastName: "Viewer",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${suffix}@${testDomain}`,
      firstName: "Module6",
      lastName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const moderator = await prisma.user.create({
    data: {
      email: `moderator-${suffix}@${testDomain}`,
      firstName: "Module6",
      lastName: "Moderator",
      role: "MODERATOR",
      status: "ACTIVE",
    },
  });
  const superAdmin = await prisma.user.create({
    data: {
      email: `super-admin-${suffix}@${testDomain}`,
      firstName: "Module6",
      lastName: "SuperAdmin",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });
  const publicCommunity = await prisma.community.create({
    data: {
      slug: `module6-public-${suffix}`,
      name: `${prefix} Public ${suffix}`,
      description: "Public test community",
      type: "TOPIC",
      createdById: subject.id,
      ownerId: subject.id,
      isPrivate: false,
      members: { create: { userId: subject.id, role: "OWNER" } },
    },
  });
  const privateCommunity = await prisma.community.create({
    data: {
      slug: `module6-private-${suffix}`,
      name: `${prefix} Private ${suffix}`,
      description: "Private test community",
      type: "TOPIC",
      createdById: subject.id,
      ownerId: subject.id,
      isPrivate: true,
      members: { create: { userId: subject.id, role: "OWNER" } },
    },
  });
  const publicPost = await prisma.post.create({
    data: {
      communityId: publicCommunity.id,
      authorId: subject.id,
      content: "Published public profile activity.",
      status: "PUBLISHED",
    },
  });
  await prisma.post.create({
    data: {
      communityId: privateCommunity.id,
      authorId: subject.id,
      content: "Published private-community profile activity.",
      status: "PUBLISHED",
    },
  });
  const removedPost = await prisma.post.create({
    data: {
      communityId: publicCommunity.id,
      authorId: subject.id,
      content: "Removed profile activity.",
      status: "REMOVED",
    },
  });
  const category = await prisma.marketplaceCategory.create({
    data: {
      slug: `module6-category-${suffix}`,
      name: `${prefix} Category ${suffix}`,
      icon: "📦",
    },
  });
  const activeListing = await prisma.marketplaceListing.create({
    data: {
      slug: `module6-active-${suffix}`,
      sellerId: subject.id,
      categoryId: category.id,
      cityId: city.id,
      title: "Active Module 6 listing",
      description: "A visible listing for coherent profile counts.",
      priceFen: 5000,
      status: "ACTIVE",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
    },
  });
  await prisma.marketplaceListing.create({
    data: {
      slug: `module6-draft-${suffix}`,
      sellerId: subject.id,
      categoryId: category.id,
      cityId: city.id,
      title: "Draft Module 6 listing",
      description: "A hidden listing for coherent profile counts.",
      priceFen: 6000,
      status: "DRAFT",
    },
  });
  const publishedQuestion = await prisma.question.create({
    data: {
      slug: `module6-question-${suffix}`,
      authorId: subject.id,
      category: "UNIVERSITY",
      title: "How does profile activity visibility work?",
      body: "This published question is visible in the profile activity test.",
      status: "PUBLISHED",
    },
  });
  await prisma.question.create({
    data: {
      slug: `module6-hidden-question-${suffix}`,
      authorId: subject.id,
      category: "UNIVERSITY",
      title: "Hidden Module 6 question",
      body: "This removed question must not enter profile counts.",
      status: "REMOVED",
    },
  });
  const guide = await prisma.guide.create({
    data: {
      slug: `module6-guide-${suffix}`,
      title: "Module 6 saved guide",
      summary: "Published saved content.",
      category: "ARRIVAL",
      estimatedMinutes: 5,
      published: true,
      publishedAt: new Date(),
      createdById: admin.id,
    },
  });
  await prisma.bookmark.createMany({
    data: [
      { userId: subject.id, targetType: "POST", targetId: publicPost.id },
      { userId: subject.id, targetType: "POST", targetId: removedPost.id },
      {
        userId: subject.id,
        targetType: "LISTING",
        targetId: activeListing.id,
      },
      { userId: subject.id, targetType: "GUIDE", targetId: guide.id },
      {
        userId: subject.id,
        targetType: "QUESTION",
        targetId: publishedQuestion.id,
      },
    ],
  });
  return {
    suffix,
    subject,
    viewer,
    admin,
    moderator,
    superAdmin,
    publicCommunity,
    privateCommunity,
    publicPost,
    activeListing,
    publishedQuestion,
    guide,
  };
}

async function avatarBytes(color: string) {
  return new Uint8Array(
    await sharp({
      create: {
        width: 256,
        height: 256,
        channels: 3,
        background: color,
      },
    })
      .jpeg()
      .toBuffer(),
  );
}

async function uploadAvatar(replacesId?: string, color = "#16a34a") {
  const bytes = await avatarBytes(color);
  const intent = await createMediaUploadIntent(fixture.subject, {
    purpose: "PROFILE_AVATAR",
    fileName: "profile.jpg",
    mimeType: "image/jpeg",
    sizeBytes: bytes.byteLength,
    altText: "Portrait of Module 6 subject",
    replacesId,
  });
  await receiveLocalMediaUpload({
    assetId: intent.media.id,
    uploadToken: intent.upload.headers["X-Kondo-Upload-Token"] ?? null,
    contentType: "image/jpeg",
    contentLength: bytes.byteLength,
    bytes,
  });
  return completeMediaUpload(fixture.subject, intent.media.id);
}

postgresDescribe("Module 6 PostgreSQL profiles", () => {
  beforeAll(async () => {
    process.env.STORAGE_DRIVER = "local";
    process.env.STORAGE_LOCAL_ROOT = storageRoot;
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module6_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module6_fail_audit"()',
    );
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module6_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module6_fail_audit"()',
    );
    await cleanup();
    await prisma.$disconnect();
  });

  it("applies section audiences and coherent visible-content counts", async () => {
    await updateProfile(fixture.subject, {
      profileAudience: "PUBLIC",
      locationAudience: "PRIVATE",
      activityAudience: "MEMBERS",
      marketplaceAudience: "PRIVATE",
      communitiesAudience: "MEMBERS",
    });
    const anonymous = await getPublicProfile(fixture.subject.id, null);
    expect(anonymous.location).toBeNull();
    expect(anonymous.activity).toBeNull();
    expect(anonymous.marketplace).toBeNull();
    expect(anonymous.counts).toMatchObject({
      posts: null,
      listings: null,
      communities: null,
    });

    const member = await getPublicProfile(fixture.subject.id, fixture.viewer);
    expect(member.counts.posts).toBe(1);
    expect(member.counts.questions).toBe(1);
    expect(member.counts.listings).toBeNull();
    expect(member.communities).toHaveLength(1);
    expect(member.activity?.some(({ type }) => type === "QUESTION")).toBe(true);

    const owner = await getPublicProfile(fixture.subject.id, fixture.subject);
    expect(owner.counts.posts).toBe(2);
    expect(owner.counts.listings).toBe(1);
    expect(owner.communities).toHaveLength(2);

    await updateProfile(fixture.subject, { profileAudience: "PRIVATE" });
    await expect(
      getPublicProfile(fixture.subject.id, fixture.viewer),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getPublicProfile(fixture.subject.id, fixture.admin),
    ).resolves.toMatchObject({ id: fixture.subject.id });
    await updateProfile(fixture.subject, { profileAudience: "PUBLIC" });
  });

  it("returns only still-visible saved content", async () => {
    const saved = await getSavedContent(fixture.subject.id);
    expect(saved).toHaveLength(4);
    expect(saved.map(({ type }) => type).sort()).toEqual([
      "GUIDE",
      "LISTING",
      "POST",
      "QUESTION",
    ]);
    expect(saved.some(({ title }) => title.includes("Removed"))).toBe(false);
  });

  it("attaches, protects, replaces, and removes a validated avatar", async () => {
    await updateProfile(fixture.subject, { profileAudience: "PUBLIC" });
    const first = await uploadAvatar();
    await updateProfile(fixture.subject, { avatarMediaId: first.id });
    await expect(getMediaForDelivery(first.id, null)).resolves.toMatchObject({
      id: first.id,
      visibility: "PRIVATE",
      attachmentType: "USER_AVATAR",
    });

    await updateProfile(fixture.subject, { profileAudience: "PRIVATE" });
    await expect(getMediaForDelivery(first.id, null)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      getMediaForDelivery(first.id, fixture.viewer),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getMediaForDelivery(first.id, fixture.subject),
    ).resolves.toBeTruthy();
    await expect(
      getMediaForDelivery(first.id, fixture.admin),
    ).resolves.toBeTruthy();

    const replacement = await uploadAvatar(first.id, "#0ea5e9");
    await updateProfile(fixture.subject, {
      avatarMediaId: replacement.id,
      profileAudience: "MEMBERS",
    });
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: fixture.subject.id } }),
    ).resolves.toMatchObject({ avatarMediaId: replacement.id });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ status: "REMOVED" });

    await updateProfile(fixture.subject, { avatarMediaId: null });
    await expect(
      prisma.user.findUniqueOrThrow({ where: { id: fixture.subject.id } }),
    ).resolves.toMatchObject({ avatarMediaId: null });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: replacement.id },
      }),
    ).resolves.toMatchObject({
      status: "REMOVED",
      storageDeletePending: false,
    });
  });

  it("preserves and reuses profile reports with role-scoped evidence", async () => {
    const reportedAvatar = await uploadAvatar(undefined, "#be123c");
    await updateProfile(fixture.subject, {
      avatarMediaId: reportedAvatar.id,
      profileAudience: "PUBLIC",
    });
    const first = await createOrReuseProfileReport({
      reporter: fixture.viewer,
      subjectUserId: fixture.subject.id,
      reason: "INAPPROPRIATE",
      details: "The profile biography requires moderation review.",
    });
    const second = await createOrReuseProfileReport({
      reporter: fixture.viewer,
      subjectUserId: fixture.subject.id,
      reason: "SPAM",
    });
    expect(second).toEqual({ reportId: first.reportId, reused: true });
    await expect(
      createOrReuseProfileReport({
        reporter: fixture.subject,
        subjectUserId: fixture.subject.id,
        reason: "OTHER",
        details: "A member cannot report their own profile.",
      }),
    ).rejects.toBeInstanceOf(ProfileError);

    const moderatorView = await getReportDetail(
      fixture.moderator,
      first.reportId,
    );
    expect(moderatorView?.evidence[0]?.profile).toMatchObject({
      displayName: "Reported member",
      username: null,
      avatarMediaId: null,
    });
    const adminView = await getReportDetail(fixture.admin, first.reportId);
    expect(adminView?.evidence[0]?.profile).toMatchObject({
      displayName: "Module6 Subject",
      username: fixture.subject.username,
      avatarMediaId: reportedAvatar.id,
    });
    const replacement = await uploadAvatar(reportedAvatar.id, "#65a30d");
    await updateProfile(fixture.subject, { avatarMediaId: replacement.id });
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: reportedAvatar.id },
      }),
    ).resolves.toMatchObject({
      status: "REMOVED",
      retainedAt: expect.any(Date),
      storageDeletePending: false,
    });
    await expect(
      getMediaForDelivery(reportedAvatar.id, null),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      getMediaForDelivery(reportedAvatar.id, fixture.admin),
    ).resolves.toMatchObject({ id: reportedAvatar.id });
  });

  it("supports reviewed export/deletion requests and optimistic transitions", async () => {
    const first = await createAccountRequest(fixture.subject, {
      type: "DATA_EXPORT",
    });
    const reused = await createAccountRequest(fixture.subject, {
      type: "DATA_EXPORT",
    });
    expect(reused.id).toBe(first.id);
    const cancelled = await cancelAccountRequest(
      fixture.subject,
      first.id,
      first.version,
    );
    expect(cancelled.status).toBe("CANCELLED");

    const deletion = await createAccountRequest(fixture.subject, {
      type: "ACCOUNT_DELETION",
      reason: "I no longer need this Kondo account.",
    });
    await expect(
      transitionAccountRequest(fixture.moderator, {
        requestId: deletion.id,
        status: "PROCESSING",
        expectedVersion: deletion.version,
      }),
    ).rejects.toMatchObject({ status: 403 });
    const processing = await transitionAccountRequest(fixture.admin, {
      requestId: deletion.id,
      status: "PROCESSING",
      expectedVersion: deletion.version,
    });
    const completed = await transitionAccountRequest(fixture.admin, {
      requestId: deletion.id,
      status: "COMPLETED",
      expectedVersion: processing.version,
      responseNote: "Deletion review completed through the approved workflow.",
    });
    expect(completed.status).toBe("COMPLETED");
    await expect(
      transitionAccountRequest(fixture.admin, {
        requestId: deletion.id,
        status: "REJECTED",
        expectedVersion: processing.version,
        responseNote: "This stale request must not overwrite completion.",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rolls back profile and account-request mutations when audit fails", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.subject.id },
      select: { firstName: true },
    });
    const request = await createAccountRequest(fixture.subject, {
      type: "DATA_EXPORT",
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module6_fail_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" IN ('PROFILE_UPDATED', 'ACCOUNT_REQUEST_STATUS_UPDATED') THEN
          RAISE EXCEPTION 'forced Module 6 audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module6_fail_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module6_fail_audit"()
    `);
    await expect(
      updateProfile(fixture.subject, { firstName: "Changed" }),
    ).rejects.toThrow();
    await expect(
      transitionAccountRequest(fixture.admin, {
        requestId: request.id,
        status: "PROCESSING",
        expectedVersion: request.version,
      }),
    ).rejects.toThrow();
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.subject.id },
        select: { firstName: true },
      }),
    ).resolves.toEqual(before);
    await expect(
      prisma.accountRequest.findUniqueOrThrow({ where: { id: request.id } }),
    ).resolves.toMatchObject({ status: "PENDING", version: request.version });
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "module6_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION "module6_fail_audit"()');
  });

  it("provides Admin review DTOs without credential material", async () => {
    await expect(listAdminUsers(fixture.moderator)).rejects.toMatchObject({
      status: 403,
    });
    const list = await listAdminUsers(fixture.admin, {
      query: fixture.subject.email,
    });
    expect(list.users).toHaveLength(1);
    expect(list.users[0]).not.toHaveProperty("passwordHash");
    const detail = await getAdminUser(fixture.admin, fixture.subject.id);
    expect(detail).toMatchObject({
      email: fixture.subject.email,
      profileAudience: expect.any(String),
    });
    expect(detail).not.toHaveProperty("passwordHash");
    expect(detail).not.toHaveProperty("sessions");
  });

  it("limits administrator role changes to Super Admins and revokes target sessions", async () => {
    await expect(
      updateUserRoleAsAdmin({
        actor: fixture.admin,
        userId: fixture.subject.id,
        role: "ADMIN",
        reason: "Attempted role escalation by a regular administrator.",
      }),
    ).rejects.toMatchObject({ status: 403 });

    await prisma.session.create({
      data: {
        tokenHash: randomUUID().replaceAll("-", "").repeat(2),
        userId: fixture.subject.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await expect(
      updateUserRoleAsAdmin({
        actor: fixture.superAdmin,
        userId: fixture.subject.id,
        role: "ADMIN",
        reason: "Approved operational administrator assignment.",
      }),
    ).resolves.toEqual({ role: "ADMIN", sessionsRevoked: 1 });
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.subject.id },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: "ADMIN" });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: "USER_ROLE_UPDATED",
          entityId: fixture.subject.id,
          actorId: fixture.superAdmin.id,
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      updateUserRoleAsAdmin({
        actor: fixture.superAdmin,
        userId: fixture.superAdmin.id,
        role: "MEMBER",
        reason: "Self-demotion must be rejected.",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
