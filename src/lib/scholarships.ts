import {
  Prisma,
  type ReportReason,
  type ScholarshipStatus,
} from "@prisma/client";
import type {
  ScholarshipAgentInput,
  ScholarshipInput,
} from "@/features/scholarships/schemas";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export class ScholarshipError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ScholarshipError";
  }
}

function slugBase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
}

async function uniqueSlug(
  model: "scholarship" | "scholarshipAgent",
  value: string,
) {
  const base = slugBase(value) || model;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug =
      attempt === 0 ? base : `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const existing =
      model === "scholarship"
        ? await prisma.scholarship.findUnique({
            where: { slug },
            select: { id: true },
          })
        : await prisma.scholarshipAgent.findUnique({
            where: { slug },
            select: { id: true },
          });
    if (!existing) return slug;
  }
  throw new ScholarshipError("Could not create a unique page URL.", 409);
}

function dateValue(value: string | null | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

async function validateUniversities(universityIds: string[]) {
  const uniqueIds = [...new Set(universityIds)];
  if (!uniqueIds.length) return { ids: uniqueIds, countryId: null };
  const universities = await prisma.university.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: { id: true, countryId: true },
  });
  if (universities.length !== uniqueIds.length) {
    throw new ScholarshipError(
      "One or more selected universities are unavailable.",
    );
  }
  return { ids: uniqueIds, countryId: universities[0]?.countryId ?? null };
}

export function effectiveScholarshipStatus(input: {
  status: ScholarshipStatus;
  opensAt: Date | null;
  closesAt: Date | null;
}) {
  const now = new Date();
  if (input.closesAt && input.closesAt.getTime() < now.getTime()) {
    return "CLOSED" as const;
  }
  if (input.opensAt && input.opensAt.getTime() > now.getTime()) {
    return "OPENING_SOON" as const;
  }
  return input.status;
}

export async function createScholarship(input: {
  actor: Actor;
  data: ScholarshipInput;
  meta?: RequestMeta;
}) {
  const slug = await uniqueSlug("scholarship", input.data.title);
  const universities = await validateUniversities(input.data.universityIds);
  const opensAt = dateValue(input.data.opensAt);
  const closesAt = dateValue(input.data.closesAt);
  return prisma.$transaction(async (tx) => {
    const scholarship = await tx.scholarship.create({
      data: {
        slug,
        universityId: universities.ids[0] ?? null,
        countryId: input.data.countryId ?? universities.countryId,
        title: input.data.title,
        provider: input.data.provider,
        city: input.data.city,
        studyLevels: input.data.studyLevels,
        fields: input.data.fields,
        eligibleNationalities: input.data.eligibleNationalities,
        fundingType: input.data.fundingType,
        status: input.data.status,
        opensAt,
        closesAt,
        deadline: closesAt,
        applicationUrl: input.data.applicationUrl,
        description: input.data.description,
        eligibilityCriteria: input.data.eligibilityCriteria,
        requiredDocuments: input.data.requiredDocuments,
        coverage: input.data.coverage,
        applicationSteps: input.data.applicationSteps,
        isFeatured: input.data.isFeatured,
        isActive: input.data.isActive,
        lastVerifiedAt: input.data.markVerified ? new Date() : null,
      },
    });
    if (universities.ids.length) {
      await tx.scholarshipUniversity.createMany({
        data: universities.ids.map((universityId) => ({
          scholarshipId: scholarship.id,
          universityId,
        })),
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_CREATED",
      entityType: "Scholarship",
      entityId: scholarship.id,
      newValue: { title: scholarship.title, status: scholarship.status },
      ...input.meta,
    });
    return { scholarship };
  });
}

export async function updateScholarship(input: {
  actor: Actor;
  scholarshipId: string;
  data: Partial<ScholarshipInput>;
  meta?: RequestMeta;
}) {
  const existing = await prisma.scholarship.findUnique({
    where: { id: input.scholarshipId },
  });
  if (!existing) throw new ScholarshipError("Scholarship not found.", 404);
  const universities = input.data.universityIds
    ? await validateUniversities(input.data.universityIds)
    : null;
  const update: Prisma.ScholarshipUncheckedUpdateInput = {
    ...(input.data.title !== undefined ? { title: input.data.title } : {}),
    ...(input.data.provider !== undefined
      ? { provider: input.data.provider }
      : {}),
    ...(input.data.countryId !== undefined || universities
      ? {
          countryId: input.data.countryId ?? universities?.countryId ?? null,
        }
      : {}),
    ...(universities ? { universityId: universities.ids[0] ?? null } : {}),
    ...(input.data.city !== undefined ? { city: input.data.city } : {}),
    ...(input.data.studyLevels !== undefined
      ? { studyLevels: input.data.studyLevels }
      : {}),
    ...(input.data.fields !== undefined ? { fields: input.data.fields } : {}),
    ...(input.data.eligibleNationalities !== undefined
      ? { eligibleNationalities: input.data.eligibleNationalities }
      : {}),
    ...(input.data.fundingType !== undefined
      ? { fundingType: input.data.fundingType }
      : {}),
    ...(input.data.status !== undefined ? { status: input.data.status } : {}),
    ...(input.data.opensAt !== undefined
      ? { opensAt: dateValue(input.data.opensAt) }
      : {}),
    ...(input.data.closesAt !== undefined
      ? {
          closesAt: dateValue(input.data.closesAt),
          deadline: dateValue(input.data.closesAt),
        }
      : {}),
    ...(input.data.applicationUrl !== undefined
      ? { applicationUrl: input.data.applicationUrl }
      : {}),
    ...(input.data.description !== undefined
      ? { description: input.data.description }
      : {}),
    ...(input.data.eligibilityCriteria !== undefined
      ? { eligibilityCriteria: input.data.eligibilityCriteria }
      : {}),
    ...(input.data.requiredDocuments !== undefined
      ? { requiredDocuments: input.data.requiredDocuments }
      : {}),
    ...(input.data.coverage !== undefined
      ? { coverage: input.data.coverage }
      : {}),
    ...(input.data.applicationSteps !== undefined
      ? { applicationSteps: input.data.applicationSteps }
      : {}),
    ...(input.data.isFeatured !== undefined
      ? { isFeatured: input.data.isFeatured }
      : {}),
    ...(input.data.isActive !== undefined
      ? { isActive: input.data.isActive }
      : {}),
    ...(input.data.markVerified ? { lastVerifiedAt: new Date() } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const scholarship = await tx.scholarship.update({
      where: { id: input.scholarshipId },
      data: update,
    });
    if (universities) {
      await tx.scholarshipUniversity.deleteMany({
        where: { scholarshipId: scholarship.id },
      });
      if (universities.ids.length) {
        await tx.scholarshipUniversity.createMany({
          data: universities.ids.map((universityId) => ({
            scholarshipId: scholarship.id,
            universityId,
          })),
        });
      }
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_UPDATED",
      entityType: "Scholarship",
      entityId: scholarship.id,
      oldValue: { title: existing.title, status: existing.status },
      newValue: { title: scholarship.title, status: scholarship.status },
      ...input.meta,
    });
    return { scholarship };
  });
}

export async function archiveScholarship(input: {
  actor: Actor;
  scholarshipId: string;
  meta?: RequestMeta;
}) {
  const existing = await prisma.scholarship.findUnique({
    where: { id: input.scholarshipId },
    select: { id: true, isActive: true, title: true },
  });
  if (!existing) throw new ScholarshipError("Scholarship not found.", 404);
  return prisma.$transaction(async (tx) => {
    const scholarship = await tx.scholarship.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_ARCHIVED",
      entityType: "Scholarship",
      entityId: scholarship.id,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: false },
      ...input.meta,
    });
    return { archived: true };
  });
}

export async function createScholarshipAgent(input: {
  actor: Actor;
  data: ScholarshipAgentInput;
  meta?: RequestMeta;
}) {
  const slug = await uniqueSlug("scholarshipAgent", input.data.name);
  return prisma.$transaction(async (tx) => {
    const agent = await tx.scholarshipAgent.create({
      data: {
        ...input.data,
        slug,
        verifiedAt: input.data.verified ? new Date() : null,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_AGENT_CREATED",
      entityType: "ScholarshipAgent",
      entityId: agent.id,
      newValue: { name: agent.name, verified: agent.verified },
      ...input.meta,
    });
    return { agent };
  });
}

export async function updateScholarshipAgent(input: {
  actor: Actor;
  agentId: string;
  data: Partial<ScholarshipAgentInput>;
  meta?: RequestMeta;
}) {
  const existing = await prisma.scholarshipAgent.findUnique({
    where: { id: input.agentId },
  });
  if (!existing) throw new ScholarshipError("Agent not found.", 404);
  return prisma.$transaction(async (tx) => {
    const agent = await tx.scholarshipAgent.update({
      where: { id: input.agentId },
      data: {
        ...input.data,
        ...(input.data.verified === true && !existing.verified
          ? { verifiedAt: new Date() }
          : input.data.verified === false
            ? { verifiedAt: null }
            : {}),
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_AGENT_UPDATED",
      entityType: "ScholarshipAgent",
      entityId: agent.id,
      oldValue: { name: existing.name, verified: existing.verified },
      newValue: { name: agent.name, verified: agent.verified },
      ...input.meta,
    });
    return { agent };
  });
}

export async function archiveScholarshipAgent(input: {
  actor: Actor;
  agentId: string;
  meta?: RequestMeta;
}) {
  const existing = await prisma.scholarshipAgent.findUnique({
    where: { id: input.agentId },
    select: { id: true, isActive: true },
  });
  if (!existing) throw new ScholarshipError("Agent not found.", 404);
  return prisma.$transaction(async (tx) => {
    await tx.scholarshipAgent.update({
      where: { id: input.agentId },
      data: { isActive: false },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "SCHOLARSHIP_AGENT_ARCHIVED",
      entityType: "ScholarshipAgent",
      entityId: input.agentId,
      oldValue: { isActive: existing.isActive },
      newValue: { isActive: false },
      ...input.meta,
    });
    return { archived: true };
  });
}

export async function createOrReuseScholarshipAgentReport(input: {
  actor: Actor;
  agentId: string;
  reason: ReportReason;
  details: string;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.report.findFirst({
      where: {
        reporterId: input.actor.id,
        targetType: "ScholarshipAgent",
        targetId: input.agentId,
        status: { in: ["OPEN", "REVIEWING"] },
      },
      select: { id: true },
    });
    if (existing) return { reportId: existing.id, reused: true };
    const agent = await tx.scholarshipAgent.findFirst({
      where: { id: input.agentId, isActive: true },
      include: { country: { select: { name: true } } },
    });
    if (!agent) throw new ScholarshipError("Agent not found.", 404);
    const report = await tx.report.create({
      data: {
        reporterId: input.actor.id,
        targetType: "ScholarshipAgent",
        targetId: agent.id,
        reason: input.reason,
        details: input.details,
      },
    });
    await tx.reportEvidence.create({
      data: {
        reportId: report.id,
        kind: "SCHOLARSHIP_AGENT_SNAPSHOT",
        label: "Scholarship agent profile at time of report",
        capturedById: input.actor.id,
        snapshot: {
          version: 1,
          agentId: agent.id,
          name: agent.name,
          company: agent.company,
          country: agent.country?.name,
          languages: agent.languages,
          specialties: agent.specialties,
          services: agent.services,
          feeDetails: agent.feeDetails,
          verified: agent.verified,
          website: agent.website,
        },
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "REPORT_CREATED",
      entityType: "Report",
      entityId: report.id,
      newValue: {
        targetType: "ScholarshipAgent",
        targetId: agent.id,
        reason: input.reason,
      },
      ...input.meta,
    });
    return { reportId: report.id, reused: false };
  });
}
