import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSessionCredential,
  getUserPreferences,
  listUserSessions,
  revokeUserSession,
  revokeUserSessions,
  updateUserPreferences,
} from "@/lib/settings";
import {
  createDatabaseSession,
  hashSessionId,
} from "@/lib/server-auth";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module7.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await prisma.user.create({
    data: {
      email: `${suffix}@${testDomain}`,
      firstName: "Settings",
      lastName: "Member",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const otherUser = await prisma.user.create({
    data: {
      email: `other-${suffix}@${testDomain}`,
      firstName: "Other",
      lastName: "Member",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  return { user, otherUser };
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

postgresDescribe("Module 7 PostgreSQL settings and sessions", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module7_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module7_fail_audit"()',
    );
    await cleanup();
    await prisma.$disconnect();
  });

  it("returns safe defaults and persists theme, language, and notification preferences", async () => {
    await expect(getUserPreferences(fixture.user.id)).resolves.toMatchObject({
      theme: "SYSTEM",
      language: "ENGLISH",
      notificationMessages: true,
      emailDigest: "NEVER",
      updatedAt: null,
    });
    const updated = await updateUserPreferences(
      fixture.user.id,
      {
        theme: "DARK",
        language: "FRENCH",
        notificationMessages: false,
        notificationComments: true,
        notificationMarketplace: false,
        notificationAnnouncements: true,
        emailDigest: "WEEKLY",
      },
      { userAgent: "Module 7 test" },
    );
    expect(updated).toMatchObject({
      theme: "DARK",
      language: "FRENCH",
      notificationMessages: false,
      notificationMarketplace: false,
      emailDigest: "WEEKLY",
      updatedAt: expect.any(String),
    });
    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: fixture.user.id,
          action: "USER_PREFERENCES_UPDATED",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("identifies the current device without exposing token hashes or raw network metadata", async () => {
    process.env.JWT_SECRET = "module-7-integration-secret-at-least-32-bytes";
    const currentId = await createDatabaseSession({
      userId: fixture.user.id,
      ipAddress: "203.0.113.14",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await createDatabaseSession({
      userId: fixture.user.id,
      ipAddress: "198.51.100.9",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
    });
    const token = await createSessionToken({
      id: fixture.user.id,
      email: fixture.user.email,
      role: "MEMBER",
      sessionId: currentId,
    });
    const credential = await getSessionCredential(token);
    expect(credential).toEqual({
      userId: fixture.user.id,
      tokenHash: hashSessionId(currentId),
    });
    const sessions = await listUserSessions(
      fixture.user.id,
      credential!.tokenHash,
    );
    expect(sessions).toHaveLength(2);
    expect(sessions.filter(({ current }) => current)).toHaveLength(1);
    expect(sessions.find(({ current }) => current)?.device).toBe(
      "Safari on iPhone",
    );
    expect(JSON.stringify(sessions)).not.toContain("203.0.113.14");
    expect(JSON.stringify(sessions)).not.toContain("198.51.100.9");
    expect(sessions[0]).not.toHaveProperty("tokenHash");
    expect(sessions[0]).not.toHaveProperty("userAgent");
  });

  it("revokes one owned session, rejects foreign sessions, and revokes other devices", async () => {
    const currentId = await createDatabaseSession({
      userId: fixture.user.id,
      userAgent: "Current session",
    });
    const otherId = await createDatabaseSession({
      userId: fixture.user.id,
      userAgent: "Other session",
    });
    const foreignId = await createDatabaseSession({
      userId: fixture.otherUser.id,
      userAgent: "Foreign session",
    });
    const currentHash = hashSessionId(currentId);
    const other = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionId(otherId) },
    });
    const foreign = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionId(foreignId) },
    });
    await expect(
      revokeUserSession(
        fixture.user.id,
        foreign.id,
        currentHash,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      revokeUserSession(fixture.user.id, other.id, currentHash),
    ).resolves.toEqual({ revoked: 1, current: false });
    await expect(
      prisma.session.findUnique({ where: { id: other.id } }),
    ).resolves.toBeNull();
    const anotherId = await createDatabaseSession({
      userId: fixture.user.id,
      userAgent: "Another session",
    });
    await expect(
      revokeUserSessions(fixture.user.id, currentHash, "OTHERS"),
    ).resolves.toMatchObject({ current: false });
    await expect(
      prisma.session.findUnique({
        where: { tokenHash: hashSessionId(currentId) },
      }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.session.findUnique({
        where: { tokenHash: hashSessionId(anotherId) },
      }),
    ).resolves.toBeNull();
  });

  it("rolls back preference and session mutations when the mandatory audit fails", async () => {
    const sessionId = await createDatabaseSession({
      userId: fixture.user.id,
      userAgent: "Audit rollback device",
    });
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashSessionId(sessionId) },
    });
    const before = await getUserPreferences(fixture.user.id);
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "module7_fail_audit"()
      RETURNS trigger AS $$
      BEGIN
        IF NEW."action" IN ('USER_PREFERENCES_UPDATED', 'SESSION_REVOKED') THEN
          RAISE EXCEPTION 'forced Module 7 audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module7_fail_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "module7_fail_audit"()
    `);
    await expect(
      updateUserPreferences(fixture.user.id, { theme: "LIGHT" }),
    ).rejects.toThrow();
    await expect(
      revokeUserSession(
        fixture.user.id,
        session.id,
        hashSessionId("not-current"),
      ),
    ).rejects.toThrow();
    await expect(getUserPreferences(fixture.user.id)).resolves.toMatchObject({
      theme: before.theme,
      language: before.language,
    });
    await expect(
      prisma.session.findUnique({ where: { id: session.id } }),
    ).resolves.toBeTruthy();
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "module7_fail_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe('DROP FUNCTION "module7_fail_audit"()');
  });
});
