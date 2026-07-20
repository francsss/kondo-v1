import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sendDueEmailDigests } from "@/lib/email-digest";
import { enqueueNotificationJob } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module16.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function testUserIds() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  return users.map(({ id }) => id);
}

async function cleanup() {
  const userIds = await testUserIds();
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.userPreference.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [dailyDue, dailyNotYetDue, weeklyNeverSent, never, inactive] =
    await Promise.all([
      prisma.user.create({
        data: {
          email: `daily-due-${suffix}@${testDomain}`,
          firstName: "Ama",
          lastName: "Daily",
          status: "ACTIVE",
          preference: {
            create: {
              emailDigest: "DAILY",
              lastDigestSentAt: new Date(Date.now() - 25 * 60 * 60_000),
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `daily-recent-${suffix}@${testDomain}`,
          firstName: "Kofi",
          lastName: "Recent",
          status: "ACTIVE",
          preference: {
            create: {
              emailDigest: "DAILY",
              lastDigestSentAt: new Date(Date.now() - 60 * 60_000),
            },
          },
        },
      }),
      prisma.user.create({
        data: {
          email: `weekly-new-${suffix}@${testDomain}`,
          firstName: "Nana",
          lastName: "Weekly",
          status: "ACTIVE",
          preference: { create: { emailDigest: "WEEKLY" } },
        },
      }),
      prisma.user.create({
        data: {
          email: `never-${suffix}@${testDomain}`,
          firstName: "Yaw",
          lastName: "Never",
          status: "ACTIVE",
          preference: { create: { emailDigest: "NEVER" } },
        },
      }),
      prisma.user.create({
        data: {
          email: `inactive-${suffix}@${testDomain}`,
          firstName: "Efua",
          lastName: "Inactive",
          status: "SUSPENDED",
          preference: {
            create: {
              emailDigest: "DAILY",
              lastDigestSentAt: new Date(Date.now() - 25 * 60 * 60_000),
            },
          },
        },
      }),
    ]);
  return { dailyDue, dailyNotYetDue, weeklyNeverSent, never, inactive };
}

postgresDescribe("Module 16 PostgreSQL email digest", () => {
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

  it("sends only to due members with unread notifications and stamps lastDigestSentAt", async () => {
    await enqueueNotificationJob({
      recipientId: fixture.dailyDue.id,
      type: "MARKETPLACE_UPDATE",
      templateKey: "ADMIN_ANNOUNCEMENT",
      data: { title: "Digest fixture", body: "Fixture notification body." },
      dedupeKey: `digest-fixture-${fixture.dailyDue.id}`,
    });
    await prisma.notification.create({
      data: {
        recipientId: fixture.dailyDue.id,
        type: "MARKETPLACE_UPDATE",
        title: "Digest fixture",
        body: "Fixture notification body.",
      },
    });
    await prisma.notification.create({
      data: {
        recipientId: fixture.weeklyNeverSent.id,
        type: "MARKETPLACE_UPDATE",
        title: "Weekly fixture",
        body: "Weekly fixture body.",
      },
    });
    await prisma.notification.create({
      data: {
        recipientId: fixture.inactive.id,
        type: "MARKETPLACE_UPDATE",
        title: "Inactive fixture",
        body: "Should never be counted as sent.",
      },
    });

    const result = await sendDueEmailDigests();
    expect(result.sent).toBe(2);

    const [dailyDuePref, dailyRecentPref, weeklyPref, inactivePref] =
      await Promise.all([
        prisma.userPreference.findUniqueOrThrow({
          where: { userId: fixture.dailyDue.id },
        }),
        prisma.userPreference.findUniqueOrThrow({
          where: { userId: fixture.dailyNotYetDue.id },
        }),
        prisma.userPreference.findUniqueOrThrow({
          where: { userId: fixture.weeklyNeverSent.id },
        }),
        prisma.userPreference.findUniqueOrThrow({
          where: { userId: fixture.inactive.id },
        }),
      ]);
    // Sent: stamped with a fresh timestamp well after their old due-25h-ago value.
    expect(dailyDuePref.lastDigestSentAt!.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    // Not yet due: interval hasn't elapsed, so lastDigestSentAt is untouched.
    expect(dailyRecentPref.lastDigestSentAt!.getTime()).toBeLessThan(
      Date.now() - 55 * 60_000,
    );
    // Never sent before, had unread notifications: now stamped.
    expect(weeklyPref.lastDigestSentAt!.getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    // Suspended accounts are skipped before the timestamp update, even
    // though their digest was due.
    expect(inactivePref.lastDigestSentAt!.getTime()).toBeLessThan(
      Date.now() - 24 * 60 * 60_000,
    );
  });

  it("skips a due member with zero unread notifications without marking them sent", async () => {
    const before = await prisma.userPreference.findUniqueOrThrow({
      where: { userId: fixture.dailyDue.id },
    });
    const result = await sendDueEmailDigests();
    expect(result.sent).toBe(0);
    expect(result.skippedEmpty).toBeGreaterThan(0);

    const after = await prisma.userPreference.findUniqueOrThrow({
      where: { userId: fixture.dailyDue.id },
    });
    expect(after.lastDigestSentAt).toEqual(before.lastDigestSentAt);
  });

  it("is idempotent across consecutive runs once a digest has been sent", async () => {
    await prisma.notification.create({
      data: {
        recipientId: fixture.dailyDue.id,
        type: "MARKETPLACE_UPDATE",
        title: "Digest fixture",
        body: "Fixture notification body.",
      },
    });
    const first = await sendDueEmailDigests();
    expect(first.sent).toBeGreaterThan(0);
    const second = await sendDueEmailDigests();
    expect(second.sent).toBe(0);
  });
});
