import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AuthTokenError,
  confirmEmailVerification,
  confirmPasswordReset,
  requestEmailVerification,
  requestPasswordReset,
} from "@/lib/auth-tokens";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module14.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.emailVerificationToken.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.passwordResetToken.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const user = await prisma.user.create({
    data: {
      email: `member-${suffix}@${testDomain}`,
      username: `member${suffix.slice(0, 8)}`,
      firstName: "Module14",
      lastName: "Member",
      role: "MEMBER",
      status: "ACTIVE",
      passwordHash: await bcrypt.hash("OriginalPassw0rd", 12),
    },
  });
  return { user, suffix };
}

postgresDescribe("Module 14 PostgreSQL auth tokens", () => {
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

  it("verifies an email with a single-use token and rejects reuse", async () => {
    const request = await requestEmailVerification({ userId: fixture.user.id });
    expect(request.alreadyVerified).toBe(false);
    expect(request.devToken).toBeTruthy();

    const result = await confirmEmailVerification({
      token: request.devToken!,
    });
    expect(result.verified).toBe(true);

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.user.id },
        select: { emailVerifiedAt: true },
      }),
    ).resolves.toMatchObject({ emailVerifiedAt: expect.any(Date) });
    await expect(
      prisma.auditLog.count({
        where: { action: "EMAIL_VERIFIED", entityId: fixture.user.id },
      }),
    ).resolves.toBe(1);

    await expect(
      confirmEmailVerification({ token: request.devToken! }),
    ).rejects.toBeInstanceOf(AuthTokenError);
  });

  it("rejects an expired email verification token", async () => {
    const request = await requestEmailVerification({ userId: fixture.user.id });
    await prisma.emailVerificationToken.updateMany({
      where: { userId: fixture.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      confirmEmailVerification({ token: request.devToken! }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("short-circuits requesting verification for an already-verified user", async () => {
    const first = await requestEmailVerification({ userId: fixture.user.id });
    await confirmEmailVerification({ token: first.devToken! });

    const second = await requestEmailVerification({ userId: fixture.user.id });
    expect(second.alreadyVerified).toBe(true);
  });

  it("invalidates a previous verification token when a new one is requested", async () => {
    const first = await requestEmailVerification({ userId: fixture.user.id });
    const second = await requestEmailVerification({ userId: fixture.user.id });

    await expect(
      confirmEmailVerification({ token: first.devToken! }),
    ).rejects.toBeInstanceOf(AuthTokenError);
    await expect(
      confirmEmailVerification({ token: second.devToken! }),
    ).resolves.toMatchObject({ verified: true });
  });

  it("resets a password, revokes every session, and never reveals whether an email exists", async () => {
    await prisma.session.create({
      data: {
        userId: fixture.user.id,
        tokenHash: `session-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const unknown = await requestPasswordReset({
      email: `nobody-${fixture.suffix}@${testDomain}`,
    });
    expect(unknown.devToken).toBeUndefined();
    await expect(prisma.passwordResetToken.count()).resolves.toBe(0);

    const known = await requestPasswordReset({ email: fixture.user.email });
    expect(known.devToken).toBeTruthy();

    await confirmPasswordReset({
      token: known.devToken!,
      newPassword: "BrandNewPassw0rd",
    });

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.user.id },
      select: { passwordHash: true },
    });
    expect(updated.passwordHash).toBeTruthy();
    await expect(
      bcrypt.compare("BrandNewPassw0rd", updated.passwordHash!),
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare("OriginalPassw0rd", updated.passwordHash!),
    ).resolves.toBe(false);
    await expect(
      prisma.session.count({ where: { userId: fixture.user.id } }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditLog.count({
        where: { action: "PASSWORD_RESET", entityId: fixture.user.id },
      }),
    ).resolves.toBe(1);

    await expect(
      confirmPasswordReset({
        token: known.devToken!,
        newPassword: "AnotherPassw0rd1",
      }),
    ).rejects.toBeInstanceOf(AuthTokenError);
  });

  it("throttles repeated password reset requests for the same email", async () => {
    const email = `throttle-${fixture.suffix}@${testDomain}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await requestPasswordReset({ email });
    }
    await expect(
      requestPasswordReset({ email }),
    ).rejects.toMatchObject({ status: 429 });
  });
});
