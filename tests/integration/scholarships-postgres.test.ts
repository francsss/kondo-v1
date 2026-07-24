import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  archiveScholarship,
  createOrReuseScholarshipAgentReport,
  createScholarship,
  createScholarshipAgent,
  updateScholarship,
  updateScholarshipAgent,
} from "@/lib/scholarships";

const enabled =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = enabled ? describe.sequential : describe.skip;
const suffix = randomUUID().replaceAll("-", "");
let actorId = "";
let reporterId = "";
let cityId = "";
let universityId = "";
let scholarshipId = "";
let agentId = "";

postgresDescribe("Scholarship ecosystem PostgreSQL persistence", () => {
  beforeAll(async () => {
    const country = await prisma.country.upsert({
      where: { code: "CN" },
      update: { isActive: true },
      create: {
        code: "CN",
        name: "China",
        isActive: true,
        verified: true,
      },
    });
    const city = await prisma.city.create({
      data: {
        slug: `scholarships-city-${suffix}`,
        name: `Scholarships City ${suffix}`,
        countryId: country.id,
        isActive: true,
      },
    });
    cityId = city.id;
    const university = await prisma.university.create({
      data: {
        slug: `scholarships-university-${suffix}`,
        name: `Scholarships University ${suffix}`,
        countryId: country.id,
        cityId: city.id,
        isActive: true,
      },
    });
    universityId = university.id;
    const [actor, reporter] = await Promise.all([
      prisma.user.create({
        data: {
          email: `scholarship-admin-${suffix}@test.local`,
          firstName: "Scholarship",
          lastName: "Admin",
          role: "ADMIN",
          status: "ACTIVE",
        },
      }),
      prisma.user.create({
        data: {
          email: `scholarship-member-${suffix}@test.local`,
          firstName: "Scholarship",
          lastName: "Member",
          status: "ACTIVE",
        },
      }),
    ]);
    actorId = actor.id;
    reporterId = reporter.id;
  });

  afterAll(async () => {
    if (agentId)
      await prisma.scholarshipAgent.deleteMany({ where: { id: agentId } });
    if (scholarshipId)
      await prisma.scholarship.deleteMany({ where: { id: scholarshipId } });
    await prisma.user.deleteMany({
      where: { id: { in: [actorId, reporterId].filter(Boolean) } },
    });
    if (universityId)
      await prisma.university.deleteMany({ where: { id: universityId } });
    if (cityId) await prisma.city.deleteMany({ where: { id: cityId } });
    await prisma.$disconnect();
  });

  it("creates, links, updates, and archives a scholarship", async () => {
    const created = await createScholarship({
      actor: { id: actorId, role: "ADMIN" },
      data: {
        title: `Engineering Scholarship ${suffix}`,
        provider: "Kondo Foundation",
        countryId: null,
        universityIds: [universityId],
        city: null,
        studyLevels: ["MASTERS"],
        fields: ["Engineering"],
        eligibleNationalities: ["African students"],
        fundingType: "FULL",
        status: "OPEN",
        opensAt: "2027-01-01",
        closesAt: "2027-03-01",
        applicationUrl: "https://example.edu/apply",
        description:
          "A fully funded engineering opportunity for international students.",
        eligibilityCriteria: ["Bachelor degree"],
        requiredDocuments: ["Transcript"],
        coverage: ["Tuition"],
        applicationSteps: ["Apply online"],
        isFeatured: true,
        isActive: true,
        markVerified: true,
      },
    });
    scholarshipId = created.scholarship.id;
    await updateScholarship({
      actor: { id: actorId, role: "ADMIN" },
      scholarshipId,
      data: { status: "OPENING_SOON", fields: ["Engineering", "Robotics"] },
    });
    const linked = await prisma.scholarship.findUnique({
      where: { id: scholarshipId },
      include: { universities: true },
    });
    expect(linked?.fields).toContain("Robotics");
    expect(linked?.universities[0]?.universityId).toBe(universityId);
    await archiveScholarship({
      actor: { id: actorId, role: "ADMIN" },
      scholarshipId,
    });
    expect(
      await prisma.scholarship.findUnique({
        where: { id: scholarshipId },
        select: { isActive: true },
      }),
    ).toEqual({ isActive: false });
  });

  it("manages and safely reports a scholarship agent", async () => {
    const created = await createScholarshipAgent({
      actor: { id: actorId, role: "ADMIN" },
      data: {
        name: `Agent ${suffix}`,
        company: "Kondo Advisers",
        logoUrl: null,
        countryId: null,
        languages: ["English"],
        specialties: ["CSC"],
        services: ["Application review"],
        feeDetails: null,
        whatsapp: null,
        wechat: null,
        email: "agent@example.com",
        website: null,
        availability: "AVAILABLE",
        averageRating: 4.5,
        biography: "A scholarship adviser.",
        verified: true,
        isActive: true,
      },
    });
    agentId = created.agent.id;
    await updateScholarshipAgent({
      actor: { id: actorId, role: "ADMIN" },
      agentId,
      data: { availability: "LIMITED" },
    });
    const report = await createOrReuseScholarshipAgentReport({
      actor: { id: reporterId, role: "MEMBER" },
      agentId,
      reason: "OTHER",
      details: "Please verify the fee information shown on this profile.",
    });
    const reused = await createOrReuseScholarshipAgentReport({
      actor: { id: reporterId, role: "MEMBER" },
      agentId,
      reason: "OTHER",
      details: "This should reuse the currently open safety report.",
    });
    expect(reused).toEqual({ reportId: report.reportId, reused: true });
    expect(
      await prisma.reportEvidence.findFirst({
        where: { reportId: report.reportId },
        select: { kind: true },
      }),
    ).toEqual({ kind: "SCHOLARSHIP_AGENT_SNAPSHOT" });
  });
});
