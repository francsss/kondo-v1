import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addReportNote,
  assignReport,
  createOrReuseConversationReport,
  getReportDetail,
  listAuditLogs,
  listReports,
  ModerationError,
  transitionReport,
} from "@/lib/moderation";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module3.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function cleanupFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (!userIds.length) return;

  const reports = await prisma.report.findMany({
    where: {
      OR: [
        { reporterId: { in: userIds } },
        { subjectUserId: { in: userIds } },
        { assigneeId: { in: userIds } },
      ],
    },
    select: { id: true },
  });
  const reportIds = reports.map((report) => report.id);
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: { in: userIds } } } },
    select: { id: true },
  });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { entityType: "Report", entityId: { in: reportIds } },
        { entityType: "User", entityId: { in: userIds } },
      ],
    },
  });
  await prisma.report.deleteMany({ where: { id: { in: reportIds } } });
  await prisma.conversation.deleteMany({
    where: { id: { in: conversations.map((item) => item.id) } },
  });
  await prisma.userBlock.deleteMany({
    where: {
      OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture(): Promise<{
  reporter: Awaited<ReturnType<typeof createUser>>;
  subject: Awaited<ReturnType<typeof createUser>>;
  outsider: Awaited<ReturnType<typeof createUser>>;
  moderatorA: Awaited<ReturnType<typeof createUser>>;
  moderatorB: Awaited<ReturnType<typeof createUser>>;
  admin: Awaited<ReturnType<typeof createUser>>;
  superAdmin: Awaited<ReturnType<typeof createUser>>;
  conversation: { id: string };
}> {
  const suffix = randomUUID().replaceAll("-", "");
  const create = (
    label: string,
    role: "MEMBER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN",
  ) => createUser(`${label}-${suffix}`, role);
  const [
    reporter,
    subject,
    outsider,
    moderatorA,
    moderatorB,
    admin,
    superAdmin,
  ] = await Promise.all([
    create("reporter", "MEMBER"),
    create("subject", "MEMBER"),
    create("outsider", "MEMBER"),
    create("moderatora", "MODERATOR"),
    create("moderatorb", "MODERATOR"),
    create("admin", "ADMIN"),
    create("superadmin", "SUPER_ADMIN"),
  ]);

  const conversation = await prisma.conversation.create({
    data: {
      directKey: [reporter.id, subject.id].sort().join(":"),
      lastMessageAt: new Date(),
      participants: {
        create: [{ userId: reporter.id }, { userId: subject.id }],
      },
      messages: {
        create: [
          {
            senderId: reporter.id,
            body: "Please stop asking me to send an off-platform deposit.",
          },
          {
            senderId: subject.id,
            type: "DOCUMENT",
            body: "Use this payment form.",
            attachmentKey: "private/moderation/never-expose-this-key.pdf",
            attachmentName: "payment-form.pdf",
            attachmentMime: "application/pdf",
            attachmentSize: 12_345,
          },
        ],
      },
    },
    select: { id: true },
  });

  return {
    reporter,
    subject,
    outsider,
    moderatorA,
    moderatorB,
    admin,
    superAdmin,
    conversation,
  };
}

function createUser(
  label: string,
  role: "MEMBER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN",
) {
  return prisma.user.create({
    data: {
      email: `${label}@${testDomain}`,
      username: label,
      firstName: label.split("-")[0] ?? label,
      lastName: "Module3",
      role,
      status: "ACTIVE",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      role: true,
    },
  });
}

async function createConversationReport(
  fixture: Fixture,
  metadata = {
    ipAddress: "203.0.113.42",
    userAgent: "Kondo Module 3 Integration Test",
  },
) {
  return createOrReuseConversationReport({
    reporterId: fixture.reporter.id,
    conversationId: fixture.conversation.id,
    reason: "SCAM",
    details: "The other participant requested an off-platform deposit.",
    metadata,
  });
}

postgresDescribe("Module 3 PostgreSQL moderation workflow", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module3_fail_report_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module3_fail_report_audit"()',
    );
    await cleanupFixtures();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module3_fail_report_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module3_fail_report_audit"()',
    );
    await cleanupFixtures();
    await prisma.$disconnect();
  });

  it("requires conversation participation and reuses one active report under concurrency", async () => {
    const fixture = await createFixture();

    await expect(
      createOrReuseConversationReport({
        reporterId: fixture.outsider.id,
        conversationId: fixture.conversation.id,
        reason: "SPAM",
      }),
    ).rejects.toMatchObject({ status: 404 });

    const results = await Promise.all([
      createConversationReport(fixture),
      createConversationReport(fixture),
    ]);
    expect(results.map((result) => result.reused).sort()).toEqual([
      false,
      true,
    ]);
    expect(new Set(results.map((result) => result.reportId)).size).toBe(1);

    const reused = await createConversationReport(fixture);
    expect(reused).toEqual({
      reportId: results[0]?.reportId,
      reused: true,
    });

    expect(
      await prisma.report.count({
        where: {
          reporterId: fixture.reporter.id,
          targetType: "Conversation",
          targetId: fixture.conversation.id,
          status: { in: ["OPEN", "REVIEWING"] },
        },
      }),
    ).toBe(1);
    expect(
      await prisma.reportEvidence.count({
        where: { reportId: results[0]?.reportId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "Report",
          entityId: results[0]?.reportId,
          action: "REPORT_CREATED",
        },
      }),
    ).toBe(1);
  });

  it("filters and paginates the queue without exposing raw Prisma users", async () => {
    const fixture = await createFixture();
    await prisma.report.createMany({
      data: Array.from({ length: 7 }, (_, index) => ({
        reporterId: fixture.reporter.id,
        subjectUserId: fixture.subject.id,
        assigneeId:
          index === 5
            ? fixture.moderatorA.id
            : index === 6
              ? fixture.moderatorB.id
              : null,
        targetType: "Post",
        targetId: `module3-${randomUUID()}-${index}`,
        reason: index % 2 === 0 ? "SPAM" : "HARASSMENT",
        status: index >= 5 ? "REVIEWING" : "OPEN",
      })),
    });

    const firstPage = await listReports(fixture.admin, {
      page: 1,
      pageSize: 5,
      targetType: "Post",
    });
    expect(firstPage.total).toBe(7);
    expect(firstPage.pageCount).toBe(2);
    expect(firstPage.reports).toHaveLength(5);
    expect(firstPage.reports.every((report) => report.reporter === null)).toBe(
      true,
    );
    expect(JSON.stringify(firstPage)).not.toContain("@module3.test");
    expect(JSON.stringify(firstPage)).not.toContain("passwordHash");

    const spam = await listReports(fixture.admin, {
      page: 1,
      pageSize: 20,
      targetType: "Post",
      reason: "SPAM",
    });
    expect(spam.total).toBe(4);

    const moderatorQueue = await listReports(fixture.moderatorA, {
      page: 1,
      pageSize: 20,
      targetType: "Post",
    });
    expect(moderatorQueue.total).toBe(6);
    expect(
      moderatorQueue.reports.some(
        (report) => report.assignee?.id === fixture.moderatorB.id,
      ),
    ).toBe(false);
  });

  it("redacts sensitive evidence and AuditLog metadata by role", async () => {
    const fixture = await createFixture();
    const created = await createConversationReport(fixture);

    await expect(
      getReportDetail(
        { id: fixture.reporter.id, role: "MEMBER" },
        created.reportId,
      ),
    ).rejects.toMatchObject({ status: 403 });

    const moderatorView = await getReportDetail(
      fixture.moderatorA,
      created.reportId,
    );
    expect(moderatorView?.reporter).toBeNull();
    expect(moderatorView?.permissions.evidenceLevel).toBe("redacted");
    expect(moderatorView?.evidence[0]?.conversationId).toBeNull();
    expect(moderatorView?.evidence[0]?.participants[0]?.id).toBeNull();
    expect(moderatorView?.evidence[0]?.participants[0]?.username).toBeNull();
    expect(moderatorView?.evidence[0]?.messages[0]?.id).toBeNull();
    expect(
      moderatorView?.evidence[0]?.messages.find(
        (message) => message.attachmentName === "payment-form.pdf",
      )?.attachmentMime,
    ).toBeNull();
    expect(JSON.stringify(moderatorView)).not.toContain(
      "never-expose-this-key",
    );

    const adminView = await getReportDetail(fixture.admin, created.reportId);
    expect(adminView?.reporter?.id).toBe(fixture.reporter.id);
    expect(adminView?.permissions.evidenceLevel).toBe("full");
    expect(adminView?.evidence[0]?.conversationId).toBeNull();
    expect(adminView?.evidence[0]?.participants[0]?.name).not.toMatch(
      /Reporting member|Reported member/,
    );
    expect(adminView?.evidence[0]?.participants[0]?.username).toBeTruthy();
    expect(
      adminView?.evidence[0]?.messages.find(
        (message) => message.attachmentName === "payment-form.pdf",
      )?.attachmentMime,
    ).toBe("application/pdf");

    const superView = await getReportDetail(
      fixture.superAdmin,
      created.reportId,
    );
    expect(superView?.permissions.evidenceLevel).toBe("security");
    expect(superView?.evidence[0]?.conversationId).toBe(
      fixture.conversation.id,
    );
    expect(superView?.evidence[0]?.participants[0]?.id).toBeTruthy();
    expect(superView?.auditLogs[0]?.ipAddress).toBe("203.0.113.42");
    expect(adminView?.auditLogs[0]?.ipAddress).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: {
          actorId: fixture.admin.id,
          entityType: "Report",
          entityId: created.reportId,
          action: "REPORT_REPORTER_IDENTITY_VIEWED",
        },
      }),
    ).toBe(1);

    await expect(listAuditLogs(fixture.moderatorA)).rejects.toBeInstanceOf(
      ModerationError,
    );
    const adminAudit = await listAuditLogs(fixture.admin, {
      entityType: "Report",
      query: created.reportId,
    });
    const superAudit = await listAuditLogs(fixture.superAdmin, {
      entityType: "Report",
      query: created.reportId,
    });
    expect(adminAudit.logs.every((log) => log.ipAddress === null)).toBe(true);
    expect(
      superAudit.logs.find((log) => log.ipAddress === "203.0.113.42")
        ?.ipAddress,
    ).toBe("203.0.113.42");
  });

  it("runs the complete report-to-resolution lifecycle with an audit for every mutation", async () => {
    const fixture = await createFixture();
    const created = await createConversationReport(fixture);

    const assigned = await assignReport({
      actor: fixture.admin,
      reportId: created.reportId,
      assigneeId: fixture.moderatorA.id,
      expectedVersion: 1,
    });
    expect(assigned).toMatchObject({
      status: "REVIEWING",
      assigneeId: fixture.moderatorA.id,
      version: 2,
    });

    await addReportNote({
      actor: fixture.moderatorA,
      reportId: created.reportId,
      body: "The evidence snapshot is sufficient for an initial decision.",
    });

    await expect(
      transitionReport({
        actor: fixture.moderatorB,
        reportId: created.reportId,
        status: "RESOLVED",
        expectedVersion: 2,
        decision: "VIOLATION_CONFIRMED",
        resolution: "Another moderator cannot resolve this assigned case.",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const resolved = await transitionReport({
      actor: fixture.moderatorA,
      reportId: created.reportId,
      status: "RESOLVED",
      expectedVersion: 2,
      decision: "VIOLATION_CONFIRMED",
      resolution: "The preserved conversation confirms an off-platform scam.",
    });
    expect(resolved.status).toBe("RESOLVED");
    expect(resolved.version).toBe(3);

    await expect(
      assignReport({
        actor: fixture.admin,
        reportId: created.reportId,
        assigneeId: fixture.moderatorB.id,
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      transitionReport({
        actor: fixture.moderatorA,
        reportId: created.reportId,
        status: "REVIEWING",
        expectedVersion: 3,
        resolution: "A moderator must not reopen a terminal report.",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const reopened = await transitionReport({
      actor: fixture.admin,
      reportId: created.reportId,
      status: "REVIEWING",
      expectedVersion: 3,
      resolution: "A second evidence source requires controlled reopening.",
    });
    expect(reopened).toMatchObject({
      status: "REVIEWING",
      assigneeId: fixture.admin.id,
      version: 4,
    });

    const reassigned = await assignReport({
      actor: fixture.admin,
      reportId: created.reportId,
      assigneeId: fixture.moderatorB.id,
      expectedVersion: 4,
    });
    expect(reassigned.version).toBe(5);

    const dismissed = await transitionReport({
      actor: fixture.moderatorB,
      reportId: created.reportId,
      status: "DISMISSED",
      expectedVersion: 5,
      decision: "NO_VIOLATION",
      resolution: "The second evidence source establishes no policy violation.",
    });
    expect(dismissed.version).toBe(6);

    await expect(
      transitionReport({
        actor: fixture.admin,
        reportId: created.reportId,
        status: "RESOLVED",
        expectedVersion: 6,
        decision: "VIOLATION_CONFIRMED",
        resolution: "A terminal report cannot change terminal state directly.",
      }),
    ).rejects.toMatchObject({ status: 409 });

    const stored = await prisma.report.findUniqueOrThrow({
      where: { id: created.reportId },
      include: { notes: true },
    });
    expect(stored).toMatchObject({
      status: "DISMISSED",
      decision: "NO_VIOLATION",
      assigneeId: fixture.moderatorB.id,
      resolvedById: fixture.moderatorB.id,
      version: 6,
    });
    expect(stored.notes).toHaveLength(1);

    const actions = (
      await prisma.auditLog.findMany({
        where: { entityType: "Report", entityId: created.reportId },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      })
    ).map((item) => item.action);
    expect(actions).toEqual([
      "REPORT_CREATED",
      "REPORT_ASSIGNED",
      "REPORT_NOTE_ADDED",
      "REPORT_RESOLVED",
      "REPORT_REOPENED",
      "REPORT_REASSIGNED",
      "REPORT_DISMISSED",
    ]);
  });

  it("rolls back the business mutation when the mandatory audit insert fails", async () => {
    const fixture = await createFixture();
    const created = await createConversationReport(fixture);

    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "module3_fail_report_audit"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW."action" = 'REPORT_ASSIGNED' THEN
          RAISE EXCEPTION 'forced audit failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module3_fail_report_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW
      EXECUTE FUNCTION "module3_fail_report_audit"()
    `);

    try {
      await expect(
        assignReport({
          actor: fixture.admin,
          reportId: created.reportId,
          assigneeId: fixture.moderatorA.id,
          expectedVersion: 1,
        }),
      ).rejects.toThrow(/forced audit failure/);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "module3_fail_report_audit_trigger" ON "AuditLog"',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION IF EXISTS "module3_fail_report_audit"()',
      );
    }

    const report = await prisma.report.findUniqueOrThrow({
      where: { id: created.reportId },
      select: { status: true, assigneeId: true, version: true },
    });
    expect(report).toEqual({
      status: "OPEN",
      assigneeId: null,
      version: 1,
    });
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "Report",
          entityId: created.reportId,
          action: "REPORT_ASSIGNED",
        },
      }),
    ).toBe(0);
  });

  it("uses optimistic concurrency so only one moderator can claim a report", async () => {
    const fixture = await createFixture();
    const created = await createConversationReport(fixture);

    const claims = await Promise.allSettled([
      assignReport({
        actor: fixture.moderatorA,
        reportId: created.reportId,
        assigneeId: fixture.moderatorA.id,
        expectedVersion: 1,
      }),
      assignReport({
        actor: fixture.moderatorB,
        reportId: created.reportId,
        assigneeId: fixture.moderatorB.id,
        expectedVersion: 1,
      }),
    ]);
    expect(claims.filter((claim) => claim.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(claims.filter((claim) => claim.status === "rejected")).toHaveLength(
      1,
    );

    const report = await prisma.report.findUniqueOrThrow({
      where: { id: created.reportId },
      select: { status: true, assigneeId: true, version: true },
    });
    expect(report.status).toBe("REVIEWING");
    expect([fixture.moderatorA.id, fixture.moderatorB.id]).toContain(
      report.assigneeId,
    );
    expect(report.version).toBe(2);
    expect(
      await prisma.auditLog.count({
        where: {
          entityType: "Report",
          entityId: created.reportId,
          action: "REPORT_ASSIGNED",
        },
      }),
    ).toBe(1);
  });
});
