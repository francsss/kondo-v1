import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  isOrderable,
  placeSimulatedOrder,
  StudyEssentialError,
} from "@/lib/study-essentials";
import {
  createStudyNote,
  getReadableEssential,
  listLibrary,
  saveReadingProgress,
} from "@/lib/study-workspace";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;

const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
const testDomain = "study-essentials.test";
const kondoSlug = `test-kondo-book-${suffix}`;
const partnerSlug = `test-partner-course-${suffix}`;
const physicalSlug = `test-kondo-planner-${suffix}`;

let userId = "";
let chapterId = "";

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  if (userIds.length) {
    await prisma.studyNote.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.studyReadingProgress.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.studyEssentialOrder.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.academicTask.deleteMany({
      where: { ownerId: { in: userIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.studyEssential.deleteMany({
    where: { slug: { in: [kondoSlug, partnerSlug, physicalSlug] } },
  });
}

postgresDescribe("Study Essentials purchase and study workspace", () => {
  beforeAll(async () => {
    await cleanup();
    const user = await prisma.user.create({
      data: {
        email: `student-${suffix}@${testDomain}`,
        firstName: "Study",
        lastName: "Tester",
        role: "MEMBER",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    userId = user.id;

    const book = await prisma.studyEssential.create({
      data: {
        slug: kondoSlug,
        title: "Test Kondo Book",
        shortDescription: "A readable Kondo title used by the test suite.",
        description: "Full description.",
        category: "Technology",
        format: "DIGITAL",
        source: "KONDO",
        status: "PUBLISHED",
        priceMinor: 5000,
        currency: "CNY",
        highlights: [],
        publishedAt: new Date(),
        chapters: {
          create: [
            { position: 1, title: "Chapter one", body: "Body of chapter one." },
            { position: 2, title: "Chapter two", body: "Body of chapter two." },
          ],
        },
      },
      select: { id: true, chapters: { select: { id: true, position: true } } },
    });
    chapterId = book.chapters.find((c) => c.position === 1)!.id;

    await prisma.studyEssential.createMany({
      data: [
        {
          slug: partnerSlug,
          title: "Test Partner Course",
          shortDescription: "A partner title bought on the partner platform.",
          description: "Full description.",
          category: "Language",
          format: "DIGITAL",
          source: "PARTNER",
          status: "PUBLISHED",
          priceMinor: null,
          providerName: "Test Partner",
          externalUrl: "https://example.org/partner",
          highlights: [],
          publishedAt: new Date(),
        },
        {
          slug: physicalSlug,
          title: "Test Kondo Planner",
          shortDescription: "A physical Kondo item.",
          description: "Full description.",
          category: "Organization",
          format: "PHYSICAL",
          source: "KONDO",
          status: "PUBLISHED",
          priceMinor: 13900,
          highlights: [],
          publishedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("keeps partner items out of the Kondo checkout", async () => {
    const partner = await prisma.studyEssential.findUniqueOrThrow({
      where: { slug: partnerSlug },
      select: { source: true, priceMinor: true, externalUrl: true },
    });
    expect(isOrderable(partner)).toBe(false);
    await expect(
      placeSimulatedOrder({
        userId,
        slug: partnerSlug,
        quantity: 1,
        paymentProvider: "SIMULATED",
      }),
    ).rejects.toBeInstanceOf(StudyEssentialError);
  });

  it("refuses a payment provider that is not wired yet", async () => {
    await expect(
      placeSimulatedOrder({
        userId,
        slug: kondoSlug,
        quantity: 1,
        paymentProvider: "ALIPAY",
      }),
    ).rejects.toThrow(/only the kondo demo payment/i);
  });

  it("settles a simulated order and prices it from the quantity", async () => {
    const order = await placeSimulatedOrder({
      userId,
      slug: physicalSlug,
      quantity: 2,
      paymentProvider: "SIMULATED",
    });
    expect(order.status).toBe("PAID");
    expect(order.paidAt).toBeInstanceOf(Date);
    expect(order.unitPriceMinor).toBe(13900);
    expect(order.totalMinor).toBe(27800);
    expect(order.reference).toMatch(/^KS-[0-9A-F]{8}$/);
    // The title is snapshotted so the order stays readable if the catalogue
    // entry is later renamed.
    expect(order.titleSnapshot).toBe("Test Kondo Planner");
  });

  it("puts a purchase in My Library without a second record to sync", async () => {
    await placeSimulatedOrder({
      userId,
      slug: kondoSlug,
      quantity: 1,
      paymentProvider: "SIMULATED",
    });
    const library = await listLibrary(userId);
    const slugs = library.map((entry) => entry.essential.slug);
    expect(slugs).toContain(kondoSlug);
    expect(slugs).toContain(physicalSlug);
    expect(slugs).not.toContain(partnerSlug);
  });

  it("lists a re-ordered essential once", async () => {
    await placeSimulatedOrder({
      userId,
      slug: kondoSlug,
      quantity: 1,
      paymentProvider: "SIMULATED",
    });
    const library = await listLibrary(userId);
    expect(
      library.filter((entry) => entry.essential.slug === kondoSlug),
    ).toHaveLength(1);
  });

  it("opens an owned resource and remembers the reading position", async () => {
    const loaded = await getReadableEssential(userId, kondoSlug);
    expect(loaded?.essential.chapters).toHaveLength(2);

    const essentialId = loaded!.essential.id;
    await saveReadingProgress({ userId, essentialId, chapterId });
    const reopened = await getReadableEssential(userId, kondoSlug);
    expect(reopened?.progress?.chapterId).toBe(chapterId);
  });

  it("refuses to open a resource the member does not own", async () => {
    await expect(
      getReadableEssential(userId, partnerSlug),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("turns a highlight into a note and a planner task", async () => {
    const note = await createStudyNote({
      userId,
      essentialSlug: kondoSlug,
      chapterId,
      highlight: "Body of chapter one.",
      body: "My professor framed this differently.",
      task: { title: "Review chapter one" },
    });
    expect(note.taskId).toBeTruthy();

    // The task must live in the existing planner, not in a parallel system.
    const task = await prisma.academicTask.findUniqueOrThrow({
      where: { id: note.taskId! },
    });
    expect(task.ownerId).toBe(userId);
    expect(task.status).toBe("PENDING");
    expect(task.title).toBe("Review chapter one");
    // The description carries the source so the task is traceable on its own.
    expect(task.description).toContain("Test Kondo Book");
    expect(task.description).toContain("Chapter one");
    expect(task.description).toContain("Body of chapter one.");
  });

  it("accepts a highlight with no written note", async () => {
    const note = await createStudyNote({
      userId,
      essentialSlug: kondoSlug,
      chapterId,
      highlight: "Body of chapter two.",
    });
    expect(note.taskId).toBeNull();
  });

  it("rejects an empty note", async () => {
    await expect(
      createStudyNote({ userId, essentialSlug: kondoSlug, chapterId }),
    ).rejects.toThrow(/highlight or write a note/i);
  });

  it("refuses a note on a resource the member does not own", async () => {
    await expect(
      createStudyNote({
        userId,
        essentialSlug: partnerSlug,
        highlight: "Not mine.",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
