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
  createDirectMessage,
  getUnreadMessageCount,
} from "@/lib/messaging";
import {
  createNotificationAnnouncement,
  enqueueNotificationJob,
  enqueuePostCommentNotification,
  getNotificationDiagnostics,
  getUnreadNotificationCount,
  hideNotification,
  listNotifications,
  listNotificationTemplates,
  markAllNotificationsRead,
  markNotificationRead,
  processNotificationJobs,
  updateNotificationTemplate,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module8.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [actor, recipient, disabledRecipient, admin, moderator] =
    await Promise.all([
      prisma.user.create({
        data: {
          email: `actor-${suffix}@${testDomain}`,
          firstName: "Ama",
          lastName: "Actor",
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          email: `recipient-${suffix}@${testDomain}`,
          firstName: "Kofi",
          lastName: "Recipient",
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          email: `disabled-${suffix}@${testDomain}`,
          firstName: "Nana",
          lastName: "Quiet",
          status: "ACTIVE",
          preference: {
            create: {
              notificationMessages: false,
              notificationComments: false,
              notificationMarketplace: false,
              notificationAnnouncements: false,
            },
          },
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
      prisma.user.create({
        data: {
          email: `moderator-${suffix}@${testDomain}`,
          firstName: "Mod",
          lastName: "Operator",
          role: "MODERATOR",
          status: "ACTIVE",
        },
      }),
    ]);
  return { actor, recipient, disabledRecipient, admin, moderator };
}

async function testUserIds() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  return users.map(({ id }) => id);
}

async function cleanup() {
  const userIds = await testUserIds();
  const announcements = await prisma.notificationAnnouncement.findMany({
    where: { createdById: { in: userIds } },
    select: { id: true },
  });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: {
      OR: [
        { recipientId: { in: userIds } },
        { announcementId: { in: announcements.map(({ id }) => id) } },
      ],
    },
  });
  await prisma.notificationAnnouncement.deleteMany({
    where: { id: { in: announcements.map(({ id }) => id) } },
  });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function resetTemplates() {
  const templates = [
    {
      key: "MESSAGE_NEW",
      titleTemplate: "New message from {{actorName}}",
      bodyTemplate: "{{preview}}",
    },
    {
      key: "POST_COMMENT",
      titleTemplate: "New comment from {{actorName}}",
      bodyTemplate: "{{preview}}",
    },
    {
      key: "QNA_REPLY",
      titleTemplate: "New answer from {{actorName}}",
      bodyTemplate: "{{preview}}",
    },
    {
      key: "MARKETPLACE_CONTACT",
      titleTemplate: "New marketplace message",
      bodyTemplate: "{{actorName}} contacted you about {{listingTitle}}.",
    },
    {
      key: "MODERATION_RESULT",
      titleTemplate: "Your report was reviewed",
      bodyTemplate: "{{outcome}}",
    },
    {
      key: "ADMIN_ANNOUNCEMENT",
      titleTemplate: "{{title}}",
      bodyTemplate: "{{body}}",
    },
  ];
  for (const template of templates) {
    await prisma.notificationTemplate.update({
      where: { key: template.key },
      data: {
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: true,
        version: 1,
        updatedById: null,
      },
    });
  }
}

postgresDescribe("Module 8 PostgreSQL notification foundation", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  beforeEach(async () => {
    const ids = Object.values(fixture).map(({ id }) => id);
    await prisma.notification.deleteMany({
      where: { recipientId: { in: ids } },
    });
    await prisma.notificationJob.deleteMany({
      where: { recipientId: { in: ids } },
    });
    await resetTemplates();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module8_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module8_fail_audit"()',
    );
    await resetTemplates();
    await cleanup();
    await prisma.$disconnect();
  });

  it("queues asynchronously, renders through a template, and deduplicates concurrent events", async () => {
    await Promise.all(
      Array.from({ length: 8 }, () =>
        enqueueNotificationJob({
          recipientId: fixture.recipient.id,
          actorId: fixture.actor.id,
          type: "MESSAGE",
          templateKey: "MESSAGE_NEW",
          data: { actorName: "Ama Actor", preview: "Hello from Jiaxing" },
          href: "/messages/thread-1",
          dedupeKey: "message:event-1",
        }),
      ),
    );
    await expect(
      prisma.notificationJob.count({
        where: {
          recipientId: fixture.recipient.id,
          dedupeKey: "message:event-1",
        },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.notification.count({
        where: { recipientId: fixture.recipient.id },
      }),
    ).resolves.toBe(0);
    await Promise.all([
      processNotificationJobs(20),
      processNotificationJobs(20),
    ]);
    const result = await listNotifications(fixture.recipient.id);
    expect(result.notifications).toHaveLength(1);
    expect(result.notifications[0]).toMatchObject({
      title: "New message from Ama Actor",
      body: "Hello from Jiaxing",
      href: "/messages/thread-1",
    });
    expect(result.notifications[0]).not.toHaveProperty("dedupeKey");
    expect(result.notifications[0]).not.toHaveProperty("data");
  });

  it("makes persisted preferences executable while always delivering moderation outcomes", async () => {
    await enqueueNotificationJob({
      recipientId: fixture.disabledRecipient.id,
      actorId: fixture.actor.id,
      type: "MESSAGE",
      templateKey: "MESSAGE_NEW",
      data: { actorName: "Ama Actor", preview: "Muted message" },
      href: "/messages/thread-2",
      dedupeKey: "message:muted",
    });
    await enqueueNotificationJob({
      recipientId: fixture.disabledRecipient.id,
      actorId: fixture.admin.id,
      type: "MODERATION_UPDATE",
      templateKey: "MODERATION_RESULT",
      data: { outcome: "Your safety report was reviewed." },
      href: "/notifications",
      dedupeKey: "report-result:required",
    });
    await processNotificationJobs(20);
    const jobs = await prisma.notificationJob.findMany({
      where: { recipientId: fixture.disabledRecipient.id },
      orderBy: { dedupeKey: "asc" },
      select: { dedupeKey: true, status: true, lastErrorCode: true },
    });
    expect(jobs).toEqual([
      {
        dedupeKey: "message:muted",
        status: "SKIPPED",
        lastErrorCode: "PREFERENCE_DISABLED",
      },
      {
        dedupeKey: "report-result:required",
        status: "COMPLETED",
        lastErrorCode: null,
      },
    ]);
    await expect(
      getUnreadNotificationCount(fixture.disabledRecipient.id),
    ).resolves.toBe(1);
  });

  it("supports pagination, individual read, click state, mark all, and soft hiding", async () => {
    await prisma.notification.createMany({
      data: Array.from({ length: 25 }, (_, index) => ({
        recipientId: fixture.recipient.id,
        type: "COMMUNITY_ANNOUNCEMENT" as const,
        title: `Update ${index + 1}`,
        body: "Useful Kondo update",
        href: "/student-hub",
        dedupeKey: `manual:${index + 1}`,
      })),
    });
    const firstPage = await listNotifications(fixture.recipient.id, {
      page: 1,
      pageSize: 20,
    });
    const secondPage = await listNotifications(fixture.recipient.id, {
      page: 2,
      pageSize: 20,
    });
    expect(firstPage).toMatchObject({
      page: 1,
      pageCount: 2,
      total: 25,
      unreadCount: 25,
    });
    expect(firstPage.notifications).toHaveLength(20);
    expect(secondPage.notifications).toHaveLength(5);
    const first = firstPage.notifications[0];
    await markNotificationRead(fixture.recipient.id, first.id);
    await expect(
      getUnreadNotificationCount(fixture.recipient.id),
    ).resolves.toBe(24);
    await expect(
      markNotificationRead(fixture.actor.id, first.id),
    ).rejects.toMatchObject({ status: 404 });
    await markAllNotificationsRead(fixture.recipient.id);
    await expect(
      getUnreadNotificationCount(fixture.recipient.id),
    ).resolves.toBe(0);
    await hideNotification(fixture.recipient.id, first.id);
    const afterHide = await listNotifications(fixture.recipient.id);
    expect(afterHide.total).toBe(24);
    await expect(
      prisma.notification.findUnique({ where: { id: first.id } }),
    ).resolves.toMatchObject({ hiddenAt: expect.any(Date) });
  });

  it("routes real direct-message producers through the asynchronous outbox", async () => {
    const result = await createDirectMessage({
      senderId: fixture.actor.id,
      recipientId: fixture.recipient.id,
      body: "A real asynchronous message",
    });
    await expect(
      prisma.notification.count({
        where: { recipientId: fixture.recipient.id },
      }),
    ).resolves.toBe(0);
    await expect(getUnreadMessageCount(fixture.recipient.id)).resolves.toBe(1);
    await expect(
      prisma.notificationJob.findUnique({
        where: {
          recipientId_dedupeKey: {
            recipientId: fixture.recipient.id,
            dedupeKey: `message:${result.message.id}`,
          },
        },
      }),
    ).resolves.toMatchObject({ status: "PENDING", type: "MESSAGE" });
    await processNotificationJobs(20);
    await expect(
      listNotifications(fixture.recipient.id),
    ).resolves.toMatchObject({
      total: 1,
      notifications: [
        expect.objectContaining({
          href: `/messages/${result.conversationId}`,
        }),
      ],
    });
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: result.conversationId,
          userId: fixture.recipient.id,
        },
      },
      data: { lastReadAt: new Date() },
    });
    await expect(getUnreadMessageCount(fixture.recipient.id)).resolves.toBe(0);
  });

  it("provides the shared comment producer and a live Marketplace contact producer", async () => {
    await prisma.$transaction((tx) =>
      enqueuePostCommentNotification(tx, {
        recipientId: fixture.recipient.id,
        actorId: fixture.actor.id,
        actorName: "Ama Actor",
        commentId: "comment-module8-contract",
        preview: "A useful comment preview",
        postHref: "/communities/general",
      }),
    );
    const suffix = randomUUID().replaceAll("-", "");
    const country = await prisma.country.create({
      data: {
        code: "N8",
        name: `Module8 Country ${suffix}`,
        isActive: true,
      },
    });
    const city = await prisma.city.create({
      data: {
        slug: `module8-city-${suffix}`,
        name: `Module8 City ${suffix}`,
        countryId: country.id,
        isActive: true,
      },
    });
    const category = await prisma.marketplaceCategory.create({
      data: {
        slug: `module8-category-${suffix}`,
        name: `Module8 Category ${suffix}`,
      },
    });
    const listing = await prisma.marketplaceListing.create({
      data: {
        slug: `module8-listing-${suffix}`,
        sellerId: fixture.recipient.id,
        categoryId: category.id,
        cityId: city.id,
        title: "Module 8 bicycle",
        description: "A test listing used for notification producer coverage.",
        priceFen: 5000,
        status: "ACTIVE",
        publishedAt: new Date(),
      },
    });
    try {
      const message = await createDirectMessage({
        senderId: fixture.actor.id,
        recipientId: fixture.recipient.id,
        body: "Is this bicycle still available?",
        sourceType: "MARKETPLACE_LISTING",
        sourceId: listing.id,
      });
      await processNotificationJobs(20);
      const notifications = await prisma.notification.findMany({
        where: { recipientId: fixture.recipient.id },
        select: { type: true, title: true, body: true, href: true },
        orderBy: { createdAt: "asc" },
      });
      expect(notifications).toEqual([
        expect.objectContaining({
          type: "COMMENT",
          title: "New comment from Ama Actor",
        }),
        expect.objectContaining({
          type: "MARKETPLACE_UPDATE",
          body: "Ama Actor contacted you about Module 8 bicycle.",
          href: `/messages/${message.conversationId}`,
        }),
      ]);
    } finally {
      await prisma.marketplaceListing.delete({ where: { id: listing.id } });
      await prisma.marketplaceCategory.delete({ where: { id: category.id } });
      await prisma.city.delete({ where: { id: city.id } });
      await prisma.country.delete({ where: { id: country.id } });
    }
  });

  it("separates Admin permissions and enforces template tokens and optimistic versions", async () => {
    await expect(
      listNotificationTemplates(fixture.moderator),
    ).rejects.toMatchObject({ status: 403 });
    const templates = await listNotificationTemplates(fixture.admin);
    const message = templates.find(({ key }) => key === "MESSAGE_NEW")!;
    await expect(
      updateNotificationTemplate(fixture.admin, {
        key: message.key,
        titleTemplate: "Unsafe {{unknownToken}}",
        bodyTemplate: "{{preview}}",
        isActive: true,
        expectedVersion: message.version,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      updateNotificationTemplate(fixture.admin, {
        key: message.key,
        titleTemplate: "Message from {{actorName}}",
        bodyTemplate: "{{preview}}",
        isActive: true,
        expectedVersion: message.version,
      }),
    ).resolves.toMatchObject({ version: message.version + 1 });
    await expect(
      updateNotificationTemplate(fixture.admin, {
        key: message.key,
        titleTemplate: "Stale update",
        bodyTemplate: "{{preview}}",
        isActive: true,
        expectedVersion: message.version,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const moderation = templates.find(
      ({ key }) => key === "MODERATION_RESULT",
    )!;
    await expect(
      updateNotificationTemplate(fixture.admin, {
        key: moderation.key,
        titleTemplate: moderation.titleTemplate,
        bodyTemplate: moderation.bodyTemplate,
        isActive: false,
        expectedVersion: moderation.version,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          action: "NOTIFICATION_TEMPLATE_UPDATED",
          actorId: fixture.admin.id,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("queues audited Admin announcements and exposes safe diagnostics without recipient data", async () => {
    await expect(
      createNotificationAnnouncement(fixture.moderator, {
        title: "Not allowed",
        body: "Moderators cannot send platform announcements.",
      }),
    ).rejects.toMatchObject({ status: 403 });
    const announcement = await createNotificationAnnouncement(fixture.admin, {
      title: "Student services update",
      body: "The student service desk has updated opening hours.",
      href: "/student-hub",
    });
    expect(announcement).toMatchObject({
      status: "QUEUED",
      recipientCount: expect.any(Number),
    });
    await processNotificationJobs(100);
    const diagnostics = await getNotificationDiagnostics(fixture.admin);
    expect(diagnostics.announcements[0]).toMatchObject({
      id: announcement.id,
    });
    expect(diagnostics.recentJobs[0]).not.toHaveProperty("recipientId");
    expect(JSON.stringify(diagnostics)).not.toContain(fixture.recipient.email);
  });

  it("retries bounded worker failures and recovers stale processing locks", async () => {
    await prisma.notificationTemplate.update({
      where: { key: "MESSAGE_NEW" },
      data: {
        titleTemplate: "{{actorName}}",
        bodyTemplate: null,
      },
    });
    await enqueueNotificationJob({
      recipientId: fixture.recipient.id,
      type: "MESSAGE",
      templateKey: "MESSAGE_NEW",
      data: {},
      href: "/messages",
      dedupeKey: "message:worker-failure",
    });
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await prisma.notificationJob.updateMany({
        where: {
          recipientId: fixture.recipient.id,
          dedupeKey: "message:worker-failure",
        },
        data: { availableAt: new Date() },
      });
      await processNotificationJobs(20);
    }
    await expect(
      prisma.notificationJob.findUnique({
        where: {
          recipientId_dedupeKey: {
            recipientId: fixture.recipient.id,
            dedupeKey: "message:worker-failure",
          },
        },
      }),
    ).resolves.toMatchObject({
      status: "FAILED",
      attempts: 3,
      lastErrorCode: "PROCESSING_ERROR",
    });

    const stale = await prisma.notificationJob.create({
      data: {
        recipientId: fixture.recipient.id,
        type: "MESSAGE",
        templateKey: "MESSAGE_NEW",
        data: { actorName: "Recovered" },
        href: "/messages",
        dedupeKey: "message:stale-lock",
        status: "PROCESSING",
        attempts: 1,
        lockedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    await processNotificationJobs(20);
    await expect(
      prisma.notificationJob.findUnique({ where: { id: stale.id } }),
    ).resolves.toMatchObject({
      status: "COMPLETED",
      lastErrorCode: null,
    });
  });

  it("rolls back template and announcement mutations when audit persistence fails", async () => {
    const before = await prisma.notificationTemplate.findUniqueOrThrow({
      where: { key: "MESSAGE_NEW" },
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module8_fail_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" IN ('NOTIFICATION_TEMPLATE_UPDATED', 'NOTIFICATION_ANNOUNCEMENT_QUEUED') THEN
          RAISE EXCEPTION 'forced Module 8 audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module8_fail_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module8_fail_audit"()
    `);
    await expect(
      updateNotificationTemplate(fixture.admin, {
        key: "MESSAGE_NEW",
        titleTemplate: "Changed {{actorName}}",
        bodyTemplate: "{{preview}}",
        isActive: true,
        expectedVersion: before.version,
      }),
    ).rejects.toThrow();
    await expect(
      createNotificationAnnouncement(fixture.admin, {
        title: "Must roll back",
        body: "This announcement cannot survive a failed audit.",
      }),
    ).rejects.toThrow();
    await expect(
      prisma.notificationTemplate.findUniqueOrThrow({
        where: { key: "MESSAGE_NEW" },
      }),
    ).resolves.toMatchObject({
      titleTemplate: before.titleTemplate,
      version: before.version,
    });
    await expect(
      prisma.notificationAnnouncement.findFirst({
        where: { title: "Must roll back" },
      }),
    ).resolves.toBeNull();
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "module8_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION "module8_fail_audit"()');
  });
});
