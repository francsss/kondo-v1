import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createDatabaseSession,
  hashSessionId,
  resolveAuthenticatedUser,
  revokeDatabaseSession,
} from "@/lib/server-auth";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "auth-stabilization.test";

postgresDescribe("Modules 0-3 PostgreSQL authentication lifecycle", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${testDomain}` } },
    });
    await prisma.$disconnect();
  });

  it("applies role, status, expiry, and revocation changes immediately", async () => {
    process.env.JWT_SECRET = "auth-integration-secret-with-at-least-32-bytes";
    const suffix = randomUUID().replaceAll("-", "");
    const user = await prisma.user.create({
      data: {
        email: `${suffix}@${testDomain}`,
        firstName: "Auth",
        lastName: "Lifecycle",
        role: "MEMBER",
        status: "ACTIVE",
      },
    });
    const sessionId = await createDatabaseSession({ userId: user.id });
    const token = await createSessionToken({
      id: user.id,
      email: user.email,
      role: "MEMBER",
      sessionId,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
    });
    await expect(resolveAuthenticatedUser(token)).resolves.toMatchObject({
      id: user.id,
      role: "ADMIN",
      status: "ACTIVE",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "SUSPENDED" },
    });
    await expect(resolveAuthenticatedUser(token)).resolves.toBeNull();

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "DEACTIVATED" },
    });
    await expect(resolveAuthenticatedUser(token)).resolves.toBeNull();

    await prisma.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE" },
    });
    await revokeDatabaseSession({ sessionId, userId: user.id });
    await expect(resolveAuthenticatedUser(token)).resolves.toBeNull();

    const expiredSessionId = await createDatabaseSession({ userId: user.id });
    const expiredToken = await createSessionToken({
      id: user.id,
      email: user.email,
      role: "ADMIN",
      sessionId: expiredSessionId,
    });
    await prisma.session.update({
      where: { tokenHash: hashSessionId(expiredSessionId) },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(resolveAuthenticatedUser(expiredToken)).resolves.toBeNull();
    await expect(
      prisma.session.findUnique({
        where: { tokenHash: hashSessionId(expiredSessionId) },
      }),
    ).resolves.toBeNull();
  });
});
