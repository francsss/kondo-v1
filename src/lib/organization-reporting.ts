import { Prisma, type ReportReason } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { organizationPublicVisibilityWhere } from "@/lib/organization-public-visibility";
import { OrganizationError } from "@/lib/organizations";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type Actor = { id: string; role: string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

const REPORT_REASON: Record<string, ReportReason> = {
  MISLEADING_IDENTITY: "SCAM",
  IMPERSONATION: "SCAM",
  SCAM_OR_FRAUD: "SCAM",
  UNSAFE_HOUSING_CLAIM: "SCAM",
  FALSE_SCHOLARSHIP_CLAIM: "SCAM",
  SUSPICIOUS_JOB: "SCAM",
  PROHIBITED_SERVICE: "INAPPROPRIATE",
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE",
  OUTDATED_INFORMATION: "OTHER",
  OTHER: "OTHER",
};

export async function createOrReuseOrganizationReport(input: {
  actor: Actor;
  organizationId: string;
  category: string;
  details: string;
  meta?: RequestMeta;
}) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: "Organization",
          targetId: input.organizationId,
          status: { in: ["OPEN", "REVIEWING"] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
      const organization = await tx.organization.findFirst({
        where: {
          id: input.organizationId,
          ...organizationPublicVisibilityWhere,
        },
        select: {
          id: true,
          slug: true,
          publicName: true,
          type: true,
          tagline: true,
          shortDescription: true,
          verificationStatus: true,
          isOfficialPartner: true,
          country: { select: { name: true } },
          city: { select: { name: true } },
          logoMediaId: true,
          coverMediaId: true,
          publishedAt: true,
        },
      });
      if (!organization)
        throw new OrganizationError("Organization not found.", 404);
      const report = await tx.report.create({
        data: {
          reporterId: input.actor.id,
          targetType: "Organization",
          targetId: organization.id,
          reason: REPORT_REASON[input.category] ?? "OTHER",
          details: input.details,
        },
        select: { id: true },
      });
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "ORGANIZATION_SNAPSHOT",
          label: "Public organization profile at time of report",
          capturedById: input.actor.id,
          snapshot: {
            version: 1,
            targetType: "Organization",
            organizationId: organization.id,
            slug: organization.slug,
            publicName: organization.publicName,
            organizationType: organization.type,
            tagline: organization.tagline,
            shortDescription: organization.shortDescription,
            country: organization.country.name,
            city: organization.city?.name ?? null,
            verificationStatus: organization.verificationStatus,
            isOfficialPartner: organization.isOfficialPartner,
            category: input.category,
            mediaIds: [
              organization.logoMediaId,
              organization.coverMediaId,
            ].filter(Boolean),
            publishedAt: organization.publishedAt?.toISOString() ?? null,
          },
        },
      });
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        organizationId: organization.id,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: "Organization",
          targetId: organization.id,
          category: input.category,
        },
        ...input.meta,
      });
      return { reportId: report.id, reused: false };
    });
    await captureServerProductEvent({
      distinctId: input.actor.id,
      event: PRODUCT_EVENTS.ORGANIZATION_REPORT_SUBMITTED,
      properties: { reused: result.reused },
    });
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: "Organization",
          targetId: input.organizationId,
          status: { in: ["OPEN", "REVIEWING"] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}
