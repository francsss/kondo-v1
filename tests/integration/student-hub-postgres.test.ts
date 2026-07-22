import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveScheduleImport } from "@/lib/schedule-import";

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

  it("atomically saves a successful analyzed import and its extraction", async () => {
    const scheduleImport = await prisma.scheduleImport.create({
      data: {
        ownerId,
        universityId,
        status: "ANALYZING",
      },
    });
    const normalized = {
      title: "AI generated timetable",
      warnings: [],
      courses: [
        {
          courseName: "Applied Economics",
          teacher: "Professor Wang",
          dayOfWeek: 2,
          specificDate: null,
          startPeriod: null,
          endPeriod: null,
          startTime: "14:00",
          endTime: "15:30",
          room: "B-304",
          building: null,
          campusLabel: null,
          startWeek: 1,
          endWeek: 16,
          weekPattern: "ALL",
          weeks: [],
          language: "en",
          notes: null,
          color: "#22A06B",
          isOptional: false,
          confidence: 0.97,
          source: "IMPORT",
        },
      ],
    };

    const saved = await saveScheduleImport({
      importId: scheduleImport.id,
      ownerId,
      expectedStatus: "ANALYZING",
      title: normalized.title,
      courses: normalized.courses,
      analysis: {
        provider: "deepseek",
        model: "deepseek-v4-pro",
        inputTokens: 50,
        outputTokens: 25,
        normalized,
        reviewCount: 0,
      },
    });

    const reloaded = await prisma.scheduleImport.findUnique({
      where: { id: scheduleImport.id },
      include: {
        result: true,
        schedule: { include: { courses: true } },
      },
    });
    expect(saved.schedule.id).toBe(reloaded?.scheduleId);
    expect(reloaded).toMatchObject({
      status: "CONFIRMED",
      provider: "deepseek",
      model: "deepseek-v4-pro",
    });
    expect(reloaded?.result?.courseCount).toBe(1);
    expect(reloaded?.schedule?.courses[0]?.courseName).toBe(
      "Applied Economics",
    );
  });

  it("does not expose another student's private schedule through owner-scoped queries", async () => {
    await expect(
      prisma.studentSchedule.findFirst({
        where: { ownerId: strangerId, title: "Spring timetable" },
      }),
    ).resolves.toBeNull();
  });
});
