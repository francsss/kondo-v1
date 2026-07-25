import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addPetFeedbackNote,
  createPetFeedback,
  exportPetFeedbackCsv,
  getPetFeedback,
  getPetFeedbackSummary,
  listPetFeedback,
  updatePetFeedbackStatus,
} from "@/lib/pet-feedback";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "kondo-pet.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map((item) => item.id);
  if (!userIds.length) return;
  await prisma.petFeedback.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [member, admin] = await Promise.all([
    prisma.user.create({
      data: {
        email: `member-${suffix}@${testDomain}`,
        firstName: "Pet",
        lastName: "Member",
        role: "MEMBER",
        status: "ACTIVE",
      },
    }),
    prisma.user.create({
      data: {
        email: `admin-${suffix}@${testDomain}`,
        firstName: "Pet",
        lastName: "Admin",
        role: "ADMIN",
        status: "ACTIVE",
      },
    }),
  ]);
  return { member, admin };
}

postgresDescribe("Kondo Pet feedback on PostgreSQL", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("stores, filters, reviews, annotates, resolves, and exports feedback", async () => {
    const created = await createPetFeedback(
      fixture.member,
      {
        category: "IDEA",
        message: "=Add a more useful city arrival checklist.",
        pagePath: "/communities/campus-life",
        submittedAfterMs: 12_400,
      },
      { ipAddress: "127.0.0.1", userAgent: "Vitest" },
    );
    expect(created).toMatchObject({ category: "IDEA", status: "NEW" });

    const listed = await listPetFeedback(fixture.admin, {
      category: "IDEA",
      pageArea: "communities",
      query: "arrival checklist",
    });
    expect(listed.feedback).toHaveLength(1);
    expect(listed.feedback[0]).toMatchObject({
      id: created.id,
      pageArea: "communities",
      submittedAfterMs: 12_400,
    });

    await expect(getPetFeedbackSummary(fixture.admin)).resolves.toMatchObject({
      counts: { NEW: 1 },
      averageSubmissionMs: 12_400,
    });

    const inProgress = await updatePetFeedbackStatus(
      fixture.admin,
      created.id,
      { status: "IN_PROGRESS", expectedVersion: 1 },
    );
    expect(inProgress).toMatchObject({
      status: "IN_PROGRESS",
      version: 2,
    });
    await addPetFeedbackNote(
      fixture.admin,
      created.id,
      { body: "Validate the idea with the arrival product team." },
      { ipAddress: "127.0.0.1", userAgent: "Vitest" },
    );
    await expect(
      updatePetFeedbackStatus(fixture.admin, created.id, {
        status: "RESOLVED",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await updatePetFeedbackStatus(fixture.admin, created.id, {
      status: "RESOLVED",
      expectedVersion: 2,
    });

    const detail = await getPetFeedback(fixture.admin, created.id);
    expect(detail).toMatchObject({
      status: "RESOLVED",
      version: 3,
      notes: [
        {
          body: "Validate the idea with the arrival product team.",
        },
      ],
    });
    expect(detail?.resolvedAt).toBeInstanceOf(Date);

    const csv = await exportPetFeedbackCsv(fixture.admin, {
      category: "IDEA",
    });
    expect(csv).toContain("kondo-pet.test");
    expect(csv).toContain(`\"'=Add a more useful city arrival checklist.\"`);
    expect(csv).toContain("Validate the idea with the arrival product team.");
  });

  it("keeps member feedback inaccessible from administration queries", async () => {
    await expect(listPetFeedback(fixture.member)).rejects.toMatchObject({
      status: 403,
    });
    await expect(exportPetFeedbackCsv(fixture.member)).rejects.toMatchObject({
      status: 403,
    });
  });
});
