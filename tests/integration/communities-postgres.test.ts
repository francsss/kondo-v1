import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  createCommunity,
  createCommunityPost,
  createOrReuseCommunityContentReport,
  createPostComment,
  getAdminCommunity,
  inviteCommunityMember,
  listAdminCommunities,
  moderateCommunityPost,
  removeCommunityMember,
  requestCommunityAccess,
  resolveCommunityAccess,
  setCommentReaction,
  transferCommunityOwnership,
  updateCommunity,
  updateCommunityAsAdmin,
  updateCommunityMemberRole,
  updatePostComment,
} from "@/lib/communities";
import { getReportDetail } from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module11.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function testUsers() {
  return prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
}

async function cleanup() {
  const userIds = (await testUsers()).map(({ id }) => id);
  if (!userIds.length) return;
  await prisma.$executeRawUnsafe(
    'DROP TRIGGER IF EXISTS "module11_fail_audit_trigger" ON "AuditLog"',
  );
  await prisma.$executeRawUnsafe(
    'DROP FUNCTION IF EXISTS "module11_fail_audit"()',
  );
  await prisma.report.deleteMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { subjectUserId: { in: userIds } },
      ],
    },
  });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: {
      OR: [
        { recipientId: { in: userIds } },
        { actorId: { in: userIds } },
      ],
    },
  });
  await prisma.auditLog.deleteMany({
    where: { actorId: { in: userIds } },
  });
  await prisma.community.deleteMany({
    where: {
      OR: [{ createdById: { in: userIds } }, { ownerId: { in: userIds } }],
    },
  });
  await prisma.mediaAsset.deleteMany({
    where: { ownerId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [owner, member, applicant, moderator, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: `owner-${suffix}@${testDomain}`,
        username: `owner${suffix.slice(0, 8)}`,
        firstName: "Jia",
        lastName: "Owner",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `member-${suffix}@${testDomain}`,
        username: `member${suffix.slice(0, 8)}`,
        firstName: "Mina",
        lastName: "Member",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `applicant-${suffix}@${testDomain}`,
        username: `applicant${suffix.slice(0, 8)}`,
        firstName: "Tao",
        lastName: "Applicant",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `moderator-${suffix}@${testDomain}`,
        username: `moderator${suffix.slice(0, 8)}`,
        firstName: "Mod",
        lastName: "Reviewer",
        role: "MODERATOR",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `admin-${suffix}@${testDomain}`,
        username: `admin${suffix.slice(0, 8)}`,
        firstName: "Admin",
        lastName: "Operator",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }),
  ]);
  return { owner, member, applicant, moderator, admin };
}

async function createActiveCommunity(
  suffix: string,
  input: { joinPolicy?: "OPEN" | "REQUEST" | "INVITE_ONLY"; isPrivate?: boolean } = {},
) {
  return prisma.community.create({
    data: {
      slug: `module11-${suffix}-${randomUUID().slice(0, 8)}`,
      name: `Module 11 ${suffix}`,
      description: "A complete PostgreSQL community operations fixture.",
      type: "TOPIC",
      status: "ACTIVE",
      joinPolicy: input.joinPolicy ?? "OPEN",
      isPrivate: input.isPrivate ?? false,
      createdById: fixture.owner.id,
      ownerId: fixture.owner.id,
      members: {
        create: { userId: fixture.owner.id, role: "OWNER" },
      },
    },
  });
}

async function createPostImage(ownerId: string) {
  const suffix = randomUUID().replaceAll("-", "");
  return prisma.mediaAsset.create({
    data: {
      ownerId,
      objectKey: `media/${ownerId}/post-image/${suffix}.jpg`,
      storageProvider: "LOCAL",
      kind: "IMAGE",
      purpose: "POST_IMAGE",
      visibility: "PUBLIC",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "community.jpg",
      extension: "jpg",
      declaredMime: "image/jpeg",
      detectedMime: "image/jpeg",
      sizeBytes: 2048,
      width: 640,
      height: 480,
      altText: "Students meeting in Jiaxing",
      checksumSha256: "b".repeat(64),
      uploadExpiresAt: new Date(Date.now() + 60_000),
      uploadedAt: new Date(),
      validatedAt: new Date(),
    },
  });
}

postgresDescribe("Module 11 PostgreSQL communities", () => {
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

  it("creates one audited owner and enforces the database owner invariant", async () => {
    const created = await createCommunity({
      actor: fixture.owner,
      data: {
        name: `Jiaxing Creators ${randomUUID().slice(0, 8)}`,
        description: "A reviewed community for international student creators.",
        type: "TOPIC",
        isPrivate: false,
        joinPolicy: "OPEN",
      },
    });
    expect(created.community.status).toBe("PENDING_REVIEW");
    await expect(
      prisma.communityMember.findUniqueOrThrow({
        where: {
          communityId_userId: {
            communityId: created.community.id,
            userId: fixture.owner.id,
          },
        },
        select: { role: true },
      }),
    ).resolves.toEqual({ role: "OWNER" });
    await expect(
      prisma.$transaction((tx) =>
        tx.communityMember.updateMany({
          where: {
            communityId: created.community.id,
            userId: fixture.owner.id,
          },
          data: { role: "MEMBER" },
        }),
      ),
    ).rejects.toThrow(/owner must have OWNER membership/);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: fixture.owner.id,
          action: "COMMUNITY_CREATED",
          entityId: created.community.id,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("supports open, request, and invitation-only membership lifecycles", async () => {
    const open = await createActiveCommunity("open");
    await expect(
      requestCommunityAccess({
        actor: fixture.member,
        communityId: open.id,
      }),
    ).resolves.toMatchObject({ state: "JOINED" });

    const requested = await createActiveCommunity("request", {
      joinPolicy: "REQUEST",
      isPrivate: true,
    });
    const access = await requestCommunityAccess({
      actor: fixture.member,
      communityId: requested.id,
      note: "I study in Jiaxing.",
    });
    expect(access.state).toBe("PENDING");
    await resolveCommunityAccess({
      actor: fixture.owner,
      communityId: requested.id,
      requestId: access.requestId!,
      status: "APPROVED",
      resolution: "Welcome to the private student group.",
    });
    await expect(
      prisma.communityMember.findUnique({
        where: {
          communityId_userId: {
            communityId: requested.id,
            userId: fixture.member.id,
          },
        },
      }),
    ).resolves.toBeTruthy();

    const invited = await createActiveCommunity("invite", {
      joinPolicy: "INVITE_ONLY",
      isPrivate: true,
    });
    await inviteCommunityMember({
      actor: fixture.owner,
      communityId: invited.id,
      userId: fixture.applicant.id,
      note: "Join the Jiaxing innovation circle.",
    });
    const visibleInvitation = await prisma.community.findFirst({
      where: {
        id: invited.id,
        accessRequests: {
          some: {
            userId: fixture.applicant.id,
            type: "INVITATION",
            status: "PENDING",
          },
        },
      },
    });
    expect(visibleInvitation).toBeTruthy();
    await expect(
      requestCommunityAccess({
        actor: fixture.applicant,
        communityId: invited.id,
      }),
    ).resolves.toMatchObject({ state: "JOINED" });
  });

  it("transfers ownership atomically and separates owner and moderator powers", async () => {
    const community = await createActiveCommunity("ownership");
    const member = await prisma.communityMember.create({
      data: { communityId: community.id, userId: fixture.member.id },
    });
    await updateCommunityMemberRole({
      actor: fixture.owner,
      communityId: community.id,
      memberId: member.id,
      role: "MODERATOR",
    });
    await transferCommunityOwnership({
      actor: fixture.owner,
      communityId: community.id,
      targetUserId: fixture.member.id,
    });
    const memberships = await prisma.communityMember.findMany({
      where: { communityId: community.id },
      select: { userId: true, role: true },
    });
    expect(memberships).toEqual(
      expect.arrayContaining([
        { userId: fixture.owner.id, role: "MODERATOR" },
        { userId: fixture.member.id, role: "OWNER" },
      ]),
    );
    await expect(
      removeCommunityMember({
        actor: fixture.owner,
        communityId: community.id,
        memberId: member.id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      prisma.community.findUniqueOrThrow({
        where: { id: community.id },
        select: { ownerId: true },
      }),
    ).resolves.toEqual({ ownerId: fixture.member.id });
  });

  it("operates posts, validated events, media, comments, reactions, and notifications", async () => {
    const community = await createActiveCommunity("content");
    await prisma.communityMember.create({
      data: { communityId: community.id, userId: fixture.member.id },
    });
    const media = await createPostImage(fixture.member.id);
    const discussion = await createCommunityPost({
      actor: fixture.member,
      data: {
        communityId: community.id,
        type: "DISCUSSION",
        content: "A useful update for international students in Jiaxing.",
        mediaIds: [media.id],
      },
    });
    expect(discussion.post.status).toBe("PUBLISHED");
    await expect(
      prisma.postMedia.findUnique({ where: { mediaId: media.id } }),
    ).resolves.toMatchObject({ postId: discussion.post.id });

    const event = await createCommunityPost({
      actor: fixture.member,
      data: {
        communityId: community.id,
        type: "EVENT",
        title: "Jiaxing innovation meetup",
        content: "Students and local companies meet to exchange opportunities.",
        mediaIds: [],
        eventAt: new Date(Date.now() + 86_400_000),
        eventLocation: "Jiaxing Innovation Center",
      },
    });
    expect(event.post.status).toBe("PENDING_REVIEW");
    await expect(
      moderateCommunityPost({
        actor: fixture.owner,
        postId: event.post.id,
        action: "PUBLISH",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const validated = await moderateCommunityPost({
      actor: fixture.owner,
      postId: event.post.id,
      action: "VALIDATE_EVENT",
    });
    expect(validated.post).toMatchObject({ status: "PUBLISHED" });

    await expect(
      createCommunityPost({
        actor: fixture.member,
        data: {
          communityId: community.id,
          type: "ANNOUNCEMENT",
          title: "Member announcement",
          content: "Members cannot publish operational announcements.",
          mediaIds: [],
        },
      }),
    ).rejects.toMatchObject({ status: 403 });
    const announcement = await createCommunityPost({
      actor: fixture.owner,
      data: {
        communityId: community.id,
        type: "ANNOUNCEMENT",
        title: "Official community update",
        content: "The next verified activity is now available.",
        mediaIds: [],
      },
    });
    await moderateCommunityPost({
      actor: fixture.owner,
      postId: announcement.post.id,
      action: "PIN",
    });
    await expect(
      prisma.notificationJob.findFirst({
        where: {
          recipientId: fixture.member.id,
          dedupeKey: {
            startsWith: `community-announcement:${announcement.post.id}:`,
          },
        },
      }),
    ).resolves.toBeTruthy();

    const root = await createPostComment({
      actor: fixture.owner,
      postId: discussion.post.id,
      content: "Thanks for sharing this with the community.",
    });
    const reply = await createPostComment({
      actor: fixture.member,
      postId: discussion.post.id,
      parentId: root.comment.id,
      content: "Happy to help other students.",
    });
    await updatePostComment({
      actor: fixture.member,
      commentId: reply.comment.id,
      content: "Happy to help other international students.",
    });
    await setCommentReaction({
      actor: fixture.owner,
      commentId: reply.comment.id,
      type: "HELPFUL",
      reacted: true,
    });
    await expect(
      prisma.notificationJob.findFirst({
        where: {
          recipientId: fixture.member.id,
          type: "COMMENT",
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.reaction.count({ where: { commentId: reply.comment.id } }),
    ).resolves.toBe(1);
  });

  it("reuses concurrent content reports, retains evidence, and redacts it by role", async () => {
    const community = await createActiveCommunity("reports");
    await prisma.communityMember.create({
      data: { communityId: community.id, userId: fixture.member.id },
    });
    const media = await createPostImage(fixture.member.id);
    const post = await createCommunityPost({
      actor: fixture.member,
      data: {
        communityId: community.id,
        type: "DISCUSSION",
        title: "Reported content fixture",
        content: "Content preserved exactly as it appeared when reported.",
        mediaIds: [media.id],
      },
    });
    const reports = await Promise.all([
      createOrReuseCommunityContentReport({
        actor: fixture.applicant,
        targetType: "Post",
        targetId: post.post.id,
        reason: "OTHER",
        details: "This content needs a moderation review.",
      }),
      createOrReuseCommunityContentReport({
        actor: fixture.applicant,
        targetType: "Post",
        targetId: post.post.id,
        reason: "OTHER",
        details: "This content needs a moderation review.",
      }),
    ]);
    expect(new Set(reports.map(({ reportId }) => reportId)).size).toBe(1);
    await expect(
      prisma.report.count({
        where: {
          reporterId: fixture.applicant.id,
          targetType: "Post",
          targetId: post.post.id,
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.mediaAsset.findUniqueOrThrow({
        where: { id: media.id },
        select: { retainedAt: true },
      }),
    ).resolves.toMatchObject({ retainedAt: expect.any(Date) });

    const redacted = await getReportDetail(
      fixture.moderator,
      reports[0]!.reportId,
    );
    const full = await getReportDetail(fixture.admin, reports[0]!.reportId);
    expect(redacted?.evidence[0]?.content).toMatchObject({
      authorName: "Reported member",
      mediaIds: [],
    });
    expect(full?.evidence[0]?.content).toMatchObject({
      authorName: `${fixture.member.firstName} ${fixture.member.lastName}`,
      mediaIds: [media.id],
    });
  });

  it("provides paginated Admin CMS while denying global moderators", async () => {
    const community = await createActiveCommunity("admin");
    await expect(
      listAdminCommunities(fixture.moderator),
    ).rejects.toMatchObject({ status: 403 });
    const result = await listAdminCommunities(fixture.admin, {
      page: 1,
      pageSize: 5,
      query: "Module 11 admin",
    });
    expect(result).toMatchObject({ page: 1, pageSize: 5, total: 1 });
    expect(result.records[0]).not.toHaveProperty("createdById");
    await updateCommunityAsAdmin({
      actor: fixture.admin,
      communityId: community.id,
      status: "ARCHIVED",
      isVerified: true,
    });
    const detail = await getAdminCommunity(fixture.admin, community.id);
    expect(detail).toMatchObject({
      status: "ARCHIVED",
      isVerified: true,
      owner: { fullName: `${fixture.owner.firstName} ${fixture.owner.lastName}` },
    });
  });

  it("rolls back a community mutation when its mandatory audit write fails", async () => {
    const community = await createActiveCommunity("atomic");
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module11_fail_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" = 'COMMUNITY_UPDATED' THEN
          RAISE EXCEPTION 'module11 forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module11_fail_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module11_fail_audit"()
    `);
    await expect(
      updateCommunity({
        actor: fixture.owner,
        communityId: community.id,
        data: { description: "This update must be rolled back." },
      }),
    ).rejects.toThrow(/forced audit failure/);
    await expect(
      prisma.community.findUniqueOrThrow({
        where: { id: community.id },
        select: { description: true },
      }),
    ).resolves.toEqual({
      description: "A complete PostgreSQL community operations fixture.",
    });
  });
});
