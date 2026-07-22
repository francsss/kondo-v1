import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

const enabled =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = enabled ? describe.sequential : describe.skip;
const suffix = randomUUID().replaceAll("-", "");
let ownerId = "";
let strangerId = "";
let universityId = "";
let cityId = "";

postgresDescribe("Student Hub PostgreSQL persistence", () => {
  beforeAll(async () => {
    const country = await prisma.country.upsert({
      where: { code: "CN" },
      update: { isActive: true },
      create: {
        code: "CN",
        name: "China",
        emoji: "🇨🇳",
        isActive: true,
        verified: true,
      },
    });
    const city = await prisma.city.create({
      data: {
        slug: `student-hub-${suffix}`,
        name: `Student Hub ${suffix}`,
        countryId: country.id,
        isActive: true,
        verified: true,
      },
    });
    cityId = city.id;
    const university = await prisma.university.create({
      data: {
        slug: `student-hub-university-${suffix}`,
        name: `Student Hub University ${suffix}`,
        countryId: country.id,
        cityId: city.id,
        isActive: true,
        verified: true,
      },
    });
    universityId = university.id;
    const [owner, stranger] = await Promise.all([
      prisma.user.create({
        data: {
          email: `student-hub-owner-${suffix}@test.local`,
          firstName: "Schedule",
          lastName: "Owner",
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          email: `student-hub-stranger-${suffix}@test.local`,
          firstName: "Other",
          lastName: "Student",
          status: "ACTIVE",
        },
      }),
    ]);
    ownerId = owner.id;
    strangerId = stranger.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, strangerId].filter(Boolean) } },
    });
    if (universityId)
      await prisma.university.deleteMany({ where: { id: universityId } });
    if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.$disconnect();
  });

  it("persists a confirmed schedule and its courses across a fresh query", async () => {
    const created = await prisma.studentSchedule.create({
      data: {
        ownerId,
        universityId,
        title: "Spring timetable",
        confirmedAt: new Date(),
        courses: {
          create: {
            courseName: "International Business",
            dayOfWeek: 3,
            startTime: "10:00",
            endTime: "11:30",
            startWeek: 1,
            endWeek: 16,
            weekPattern: "ALL",
          },
        },
      },
    });
    const reloaded = await prisma.studentSchedule.findFirst({
      where: { id: created.id, ownerId },
      include: { courses: true },
    });
    expect(reloaded?.title).toBe("Spring timetable");
    expect(reloaded?.courses).toHaveLength(1);
    expect(reloaded?.courses[0]?.courseName).toBe("International Business");
  });

  it("does not expose another student's private schedule through owner-scoped queries", async () => {
    await expect(
      prisma.studentSchedule.findFirst({
        where: { ownerId: strangerId, title: "Spring timetable" },
      }),
    ).resolves.toBeNull();
  });
});
