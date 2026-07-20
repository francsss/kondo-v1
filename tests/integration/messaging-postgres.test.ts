import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getMediaForDelivery } from "@/lib/media";
import {
  clearConversationForUser,
  createDirectMessage,
  directConversationKey,
  getConversationForUser,
  getInbox,
  getMessageSafetyOverview,
  getUnreadMessageCount,
  markConversationRead,
  replyToConversation,
  setConversationArchived,
} from "@/lib/messaging";
import {
  createOrReuseConversationReport,
  getReportDetail,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module10.test";

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
  if (userIds.length === 0) return;
  const media = await prisma.mediaAsset.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  await prisma.report.deleteMany({
    where: {
      OR: [{ reporterId: { in: userIds } }, { subjectUserId: { in: userIds } }],
    },
  });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: {
      OR: [{ recipientId: { in: userIds } }, { actorId: { in: userIds } }],
    },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        {
          entityType: "MediaAsset",
          entityId: { in: media.map(({ id }) => id) },
        },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: media.map(({ id }) => id) } },
  });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [sender, recipient, stranger, moderator, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: `sender-${suffix}@${testDomain}`,
        firstName: "Mina",
        lastName: "Sender",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `recipient-${suffix}@${testDomain}`,
        firstName: "Tao",
        lastName: "Recipient",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `stranger-${suffix}@${testDomain}`,
        firstName: "Noor",
        lastName: "Stranger",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `moderator-${suffix}@${testDomain}`,
        firstName: "Mod",
        lastName: "Reviewer",
        role: "MODERATOR",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `admin-${suffix}@${testDomain}`,
        firstName: "Admin",
        lastName: "Operator",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }),
  ]);
  return { sender, recipient, stranger, moderator, admin };
}

async function createActiveMessageImage(ownerId: string) {
  const suffix = randomUUID().replaceAll("-", "");
  return prisma.mediaAsset.create({
    data: {
      ownerId,
      objectKey: `media/${ownerId}/message-image/${suffix}.jpg`,
      storageProvider: "LOCAL",
      kind: "IMAGE",
      purpose: "MESSAGE_IMAGE",
      visibility: "PRIVATE",
      status: "ACTIVE",
      scanStatus: "CLEAN",
      originalFileName: "jiaxing-campus.jpg",
      extension: "jpg",
      declaredMime: "image/jpeg",
      detectedMime: "image/jpeg",
      sizeBytes: 2048,
      width: 640,
      height: 480,
      altText: "Jiaxing university campus",
      checksumSha256: "a".repeat(64),
      uploadExpiresAt: new Date(Date.now() + 60_000),
      uploadedAt: new Date(),
      validatedAt: new Date(),
    },
  });
}

postgresDescribe("Module 10 PostgreSQL messaging and safety", () => {
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

  it("enforces canonical two-participant DIRECT conversations", async () => {
    const created = await createDirectMessage({
      senderId: fixture.sender.id,
      recipientId: fixture.recipient.id,
      body: "Hello from a cardinality-safe conversation.",
    });
    await expect(
      prisma.conversationParticipant.count({
        where: { conversationId: created.conversationId },
      }),
    ).resolves.toBe(2);
    await expect(
      prisma.conversation.findUniqueOrThrow({
        where: { id: created.conversationId },
        select: { directKey: true },
      }),
    ).resolves.toEqual({
      directKey: directConversationKey(fixture.sender.id, fixture.recipient.id),
    });

    await expect(
      prisma.$transaction((tx) =>
        tx.conversationParticipant.create({
          data: {
            conversationId: created.conversationId,
            userId: fixture.stranger.id,
          },
        }),
      ),
    ).rejects.toThrow(/exactly two participants/);
    await expect(
      prisma.conversationParticipant.count({
        where: { conversationId: created.conversationId },
      }),
    ).resolves.toBe(2);
  });

  it("paginates and searches the inbox without changing its direct histories", async () => {
    const names = ["Hangzhou", "Shanghai", "Jiaxing"];
    for (const [index, name] of names.entries()) {
      const partner = await prisma.user.create({
        data: {
          email: `partner-${name.toLowerCase()}-${randomUUID()}@${testDomain}`,
          firstName: name,
          lastName: "Partner",
          status: "ACTIVE",
        },
      });
      const createdAt = new Date(Date.now() + index * 1000);
      await prisma.conversation.create({
        data: {
          directKey: directConversationKey(fixture.recipient.id, partner.id),
          lastMessageAt: createdAt,
          participants: {
            create: [{ userId: fixture.recipient.id }, { userId: partner.id }],
          },
          messages: {
            create: {
              senderId: partner.id,
              body: `Update from ${name}`,
              createdAt,
            },
          },
        },
      });
    }

    const first = await getInbox(fixture.recipient.id, {
      page: 1,
      pageSize: 2,
    });
    const second = await getInbox(fixture.recipient.id, {
      page: 2,
      pageSize: 2,
    });
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: 3 });
    expect(first.conversations).toHaveLength(2);
    expect(second.conversations).toHaveLength(1);
    expect(first.conversations[0]?.otherParticipant?.firstName).toBe("Jiaxing");

    const search = await getInbox(fixture.recipient.id, {
      query: "Shanghai",
    });
    expect(search.total).toBe(1);
    expect(search.conversations[0]?.latestMessage?.body).toContain("Shanghai");
  });

  it("uses explicit read positions and supports archive, clear, and safe reappearance", async () => {
    const first = await createDirectMessage({
      senderId: fixture.sender.id,
      recipientId: fixture.recipient.id,
      body: "First unread message",
    });
    const second = await replyToConversation({
      conversationId: first.conversationId,
      senderId: fixture.sender.id,
      body: "Second unread message",
    });
    await expect(getUnreadMessageCount(fixture.recipient.id)).resolves.toBe(2);

    await markConversationRead({
      conversationId: first.conversationId,
      userId: fixture.recipient.id,
      latestMessageId: first.message.id,
    });
    await expect(getUnreadMessageCount(fixture.recipient.id)).resolves.toBe(1);
    await markConversationRead({
      conversationId: first.conversationId,
      userId: fixture.recipient.id,
      latestMessageId: second.message.id,
    });
    await expect(getUnreadMessageCount(fixture.recipient.id)).resolves.toBe(0);

    await setConversationArchived({
      conversationId: first.conversationId,
      userId: fixture.recipient.id,
      archived: true,
    });
    await expect(getInbox(fixture.recipient.id)).resolves.toMatchObject({
      total: 0,
    });
    await expect(
      getInbox(fixture.recipient.id, { archived: true }),
    ).resolves.toMatchObject({ total: 1 });
    await setConversationArchived({
      conversationId: first.conversationId,
      userId: fixture.recipient.id,
      archived: false,
    });

    await clearConversationForUser({
      conversationId: first.conversationId,
      userId: fixture.recipient.id,
    });
    await expect(getInbox(fixture.recipient.id)).resolves.toMatchObject({
      total: 0,
    });
    const cleared = await getConversationForUser(
      first.conversationId,
      fixture.recipient.id,
    );
    expect(cleared?.messages).toHaveLength(0);

    await replyToConversation({
      conversationId: first.conversationId,
      senderId: fixture.sender.id,
      body: "A new message after the recipient cleared history",
    });
    const reappeared = await getInbox(fixture.recipient.id);
    expect(reappeared.total).toBe(1);
    expect(reappeared.conversations[0]?.latestMessage?.body).toContain(
      "after the recipient cleared",
    );
    const visible = await getConversationForUser(
      first.conversationId,
      fixture.recipient.id,
    );
    expect(visible?.messages.map(({ body }) => body)).toEqual([
      "A new message after the recipient cleared history",
    ]);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: fixture.recipient.id,
          action: "CONVERSATION_CLEARED_FOR_USER",
          entityId: first.conversationId,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("attaches validated private media and keeps safety access report-bound", async () => {
    const media = await createActiveMessageImage(fixture.sender.id);
    const created = await createDirectMessage({
      senderId: fixture.sender.id,
      recipientId: fixture.recipient.id,
      mediaId: media.id,
    });
    const stored = await prisma.message.findUniqueOrThrow({
      where: { id: created.message.id },
      select: {
        mediaId: true,
        type: true,
        attachmentName: true,
        media: {
          select: { attachmentType: true, attachmentId: true, objectKey: true },
        },
      },
    });
    expect(stored).toMatchObject({
      mediaId: media.id,
      type: "IMAGE",
      attachmentName: "jiaxing-campus.jpg",
      media: {
        attachmentType: "CONVERSATION",
        attachmentId: created.conversationId,
      },
    });
    const memberView = await getConversationForUser(
      created.conversationId,
      fixture.recipient.id,
    );
    expect(memberView?.messages[0]?.attachment).toMatchObject({
      id: media.id,
      kind: "IMAGE",
      available: true,
    });
    expect(JSON.stringify(memberView)).not.toContain(stored.media?.objectKey);
    await expect(
      getMediaForDelivery(media.id, fixture.recipient),
    ).resolves.toMatchObject({ id: media.id });
    await expect(
      getMediaForDelivery(media.id, fixture.stranger),
    ).rejects.toMatchObject({ status: 404 });

    const report = await createOrReuseConversationReport({
      reporterId: fixture.recipient.id,
      conversationId: created.conversationId,
      reason: "SCAM",
      details: "The attachment was used in a suspicious payment request.",
    });
    const moderatorView = await getReportDetail(
      fixture.moderator,
      report.reportId,
    );
    expect(moderatorView?.evidence[0]?.messages[0]).toMatchObject({
      attachmentName: "jiaxing-campus.jpg",
      attachmentMime: null,
    });
    expect(JSON.stringify(moderatorView)).not.toContain(
      stored.media?.objectKey,
    );

    await expect(
      getMessageSafetyOverview(fixture.recipient),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      getMessageSafetyOverview(fixture.moderator),
    ).rejects.toMatchObject({ status: 403 });
    const safety = await getMessageSafetyOverview(fixture.admin);
    expect(safety.privacy.rawConversationAccess).toBe(false);
    expect(safety.metrics.attachmentMessages).toBeGreaterThanOrEqual(1);
    expect(safety.recentReports[0]).not.toHaveProperty("messages");
    expect(JSON.stringify(safety)).not.toContain("suspicious payment request");
  });

  it("deletes a DIRECT thread as one unit when a participant is physically removed", async () => {
    const created = await createDirectMessage({
      senderId: fixture.sender.id,
      recipientId: fixture.recipient.id,
      body: "Thread removed only with a physical participant deletion.",
    });
    await prisma.user.delete({ where: { id: fixture.sender.id } });
    await expect(
      prisma.conversation.findUnique({ where: { id: created.conversationId } }),
    ).resolves.toBeNull();
  });
});
