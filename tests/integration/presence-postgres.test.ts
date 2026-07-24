import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { DatabasePresenceStore } from "@/lib/presence";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "presence-module.test";

postgresDescribe("user presence heartbeat lifecycle", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { endsWith: `@${testDomain}` } },
    });
    await prisma.$disconnect();
  });

  it("keeps one online record, redacts its route, and expires after seven minutes", async () => {
    const suffix = randomUUID().replaceAll("-", "");
    const country = await prisma.country.upsert({
      where: { code: "CN" },
      update: {},
      create: { code: "CN", name: "China" },
    });
    const city = await prisma.city.create({
      data: {
        slug: `presence-city-${suffix}`,
        name: `Presence City ${suffix}`,
        province: "Zhejiang",
        countryId: country.id,
      },
    });
    const university = await prisma.university.create({
      data: {
        slug: `presence-university-${suffix}`,
        name: `Presence University ${suffix}`,
        cityId: city.id,
        countryId: country.id,
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `${suffix}@${testDomain}`,
        firstName: "Live",
        lastName: "Member",
        role: "MEMBER",
        status: "ACTIVE",
        countryId: country.id,
        cityId: city.id,
        universityId: university.id,
      },
    });
    const store = new DatabasePresenceStore();
    const connectedAt = new Date("2026-07-24T10:00:00.000Z");

    await store.heartbeat({
      userId: user.id,
      clientSessionId: "client-session-one",
      currentPath: "/messages/private-conversation?token=secret",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1",
      now: connectedAt,
    });

    const online = await store.listOnline(new Date("2026-07-24T10:06:00.000Z"));
    expect(online).toEqual([
      expect.objectContaining({
        userId: user.id,
        currentPath: "/messages/[conversation]",
        currentPage: "Conversation",
        device: "Mobile",
        operatingSystem: "iOS",
        city: city.name,
        university: university.name,
      }),
    ]);

    await expect(
      store.listOnline(new Date("2026-07-24T10:07:00.001Z")),
    ).resolves.toEqual([]);

    const reconnectedAt = new Date("2026-07-24T10:08:00.000Z");
    await store.heartbeat({
      userId: user.id,
      clientSessionId: "client-session-two",
      currentPath: "/home",
      userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0",
      now: reconnectedAt,
    });
    await expect(
      prisma.userPresence.findUnique({
        where: { userId: user.id },
        select: { connectedAt: true, currentPath: true },
      }),
    ).resolves.toEqual({
      connectedAt: reconnectedAt,
      currentPath: "/home",
    });
  });
});
