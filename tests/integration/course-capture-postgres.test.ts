import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { StudyEssentialError } from "@/lib/study-essentials";
import {
  createCourseCapture,
  deleteCourseCapture,
  listCourseActivity,
} from "@/lib/study-workspace";
import { getWorkspaceToday } from "@/lib/study-workspace-today";

/**
 * Course captures: what a student records against one class.
 *
 * The point of these tests is that the capture is real — it survives a round
 * trip through Postgres, it stays inside the owning student's schedule, and it
 * comes back grouped by the day it happened rather than as a flat list.
 */

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const testDomain = "course-capture.test";

let ownerId = "";
let strangerId = "";
let courseId = "";
let laterCourseId = "";

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (!userIds.length) return;
  await prisma.courseCapture.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.studentSchedule.deleteMany({
    where: { ownerId: { in: userIds } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

postgresDescribe("Course captures and the day they belong to", () => {
  beforeAll(async () => {
    await cleanup();
    const [owner, stranger] = await Promise.all([
      prisma.user.create({
        data: {
          email: `owner-${suffix}@${testDomain}`,
          firstName: "Capture",
          lastName: "Owner",
          role: "MEMBER",
          status: "ACTIVE",
        },
        select: { id: true },
      }),
      prisma.user.create({
        data: {
          email: `stranger-${suffix}@${testDomain}`,
          firstName: "Not",
          lastName: "Owner",
          role: "MEMBER",
          status: "ACTIVE",
        },
        select: { id: true },
      }),
    ]);
    ownerId = owner.id;
    strangerId = stranger.id;

    // A timetable with one class that has already finished today and one that
    // has not started, so the review prompt has something to choose between.
    const schedule = await prisma.studentSchedule.create({
      data: {
        ownerId,
        title: `Capture term ${suffix}`,
        timezone: "Asia/Shanghai",
        isActive: true,
        courses: {
          create: [
            {
              courseName: "Applied Mechanics",
              dayOfWeek: 1,
              startTime: "08:00",
              endTime: "09:40",
            },
            {
              courseName: "Fluid Dynamics",
              dayOfWeek: 1,
              startTime: "14:00",
              endTime: "15:40",
            },
          ],
        },
      },
      select: { courses: { select: { id: true, courseName: true } } },
    });
    courseId = schedule.courses.find(
      (course) => course.courseName === "Applied Mechanics",
    )!.id;
    laterCourseId = schedule.courses.find(
      (course) => course.courseName === "Fluid Dynamics",
    )!.id;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("stores a typed capture against the course", async () => {
    const capture = await createCourseCapture({
      userId: ownerId,
      courseId,
      kind: "NOTE",
      body: "  Ask about the third worked example.  ",
    });
    expect(capture.kind).toBe("NOTE");
    // Whitespace is trimmed on the way in, not on the way out.
    expect(capture.body).toBe("Ask about the third worked example.");

    const stored = await prisma.courseCapture.findUniqueOrThrow({
      where: { id: capture.id },
      select: { userId: true, courseId: true, mediaId: true },
    });
    expect(stored).toEqual({ userId: ownerId, courseId, mediaId: null });
  });

  it("refuses a capture with neither text nor a file", async () => {
    await expect(
      createCourseCapture({ userId: ownerId, courseId, kind: "NOTE" }),
    ).rejects.toBeInstanceOf(StudyEssentialError);
  });

  it("refuses a capture against someone else's course", async () => {
    await expect(
      createCourseCapture({
        userId: strangerId,
        courseId,
        kind: "NOTE",
        body: "Not mine.",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await prisma.courseCapture.count({ where: { userId: strangerId } }),
    ).toBe(0);
  });

  it("groups activity by the day it happened, newest first", async () => {
    const older = await createCourseCapture({
      userId: ownerId,
      courseId,
      kind: "NOTE",
      body: "Yesterday's line.",
    });
    // Backdate one capture so two distinct days exist to group.
    await prisma.courseCapture.update({
      where: { id: older.id },
      data: { createdAt: new Date(Date.now() - 26 * 60 * 60_000) },
    });
    await createCourseCapture({
      userId: ownerId,
      courseId,
      kind: "NOTE",
      body: "Today's second line.",
    });

    const days = await listCourseActivity(ownerId, courseId);
    expect(days.length).toBeGreaterThanOrEqual(2);
    // Newest day first, and every entry inside a day shares that day.
    const keys = days.map((day) => day.key);
    expect([...keys].sort().reverse()).toEqual(keys);
    for (const day of days) {
      for (const entry of day.entries) {
        expect(entry.createdAt.getDate()).toBe(day.date.getDate());
      }
    }
    expect(days.at(-1)!.entries.map((entry) => entry.title)).toContain(
      "Yesterday's line.",
    );
  });

  it("shows a stranger nothing from this course", async () => {
    expect(await listCourseActivity(strangerId, courseId)).toEqual([]);
  });

  it("deletes only the owner's own capture", async () => {
    const capture = await createCourseCapture({
      userId: ownerId,
      courseId,
      kind: "NOTE",
      body: "Delete me.",
    });
    await expect(
      deleteCourseCapture(strangerId, capture.id),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await prisma.courseCapture.count({ where: { id: capture.id } }),
    ).toBe(1);

    await deleteCourseCapture(ownerId, capture.id);
    expect(
      await prisma.courseCapture.count({ where: { id: capture.id } }),
    ).toBe(0);
  });

  it("offers the class that just finished, and stops once the window passes", async () => {
    // A Monday, so both seeded courses fall on the day being asked about.
    const midMorning = new Date("2026-08-17T02:00:00.000Z"); // 10:00 Shanghai
    const fresh = await getWorkspaceToday(ownerId, midMorning);
    expect(fresh.justEnded?.course.id).toBe(courseId);
    expect(fresh.justEnded?.endedMinutesAgo).toBe(20);
    // The class that has not run yet is what is next, not what to review.
    expect(fresh.next?.id).toBe(laterCourseId);

    // Six hours later the morning class is well outside the review window and
    // the afternoon one has become the thing to review.
    const evening = new Date("2026-08-17T10:00:00.000Z"); // 18:00 Shanghai
    const later = await getWorkspaceToday(ownerId, evening);
    expect(later.justEnded?.course.id).toBe(laterCourseId);
    expect(later.justEnded?.endedMinutesAgo).toBe(140);
  });
});
