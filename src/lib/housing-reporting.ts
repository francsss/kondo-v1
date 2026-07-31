import { Prisma, type ReportReason } from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLogWithClient } from "@/lib/audit";
import { housingReportSchema } from "@/features/housing/schemas";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export class HousingReportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingReportError";
  }
}

export async function createOrReuseHousingReport(input: {
  actorId: string;
  listingId: string;
  data: Parameters<typeof housingReportSchema.parse>[0];
  meta?: RequestMeta;
}) {
  const data = housingReportSchema.parse(input.data);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.actorId,
          targetType: "HousingListing",
          targetId: input.listingId,
          status: { in: ["OPEN", "REVIEWING"] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
      const listing = await tx.housingListing.findFirst({
        where: { id: input.listingId, ...publicHousingListingWhere() },
        select: {
          id: true,
          title: true,
          shortDescription: true,
          description: true,
          type: true,
          status: true,
          publisherType: true,
          publisherUserId: true,
          representativeUserId: true,
          publisherOrganizationId: true,
          publicLocationLabel: true,
          monthlyRentMinor: true,
          currency: true,
          createdAt: true,
          city: { select: { name: true } },
          media: {
            where: {
              kind: { not: "PROOF_DOCUMENT" },
              media: { status: "ACTIVE", scanStatus: "CLEAN" },
            },
            select: { mediaId: true },
          },
        },
      });
      if (!listing)
        throw new HousingReportError("Housing listing not found.", 404);
      const subjectUserId =
        listing.publisherUserId ?? listing.representativeUserId ?? null;
      if (subjectUserId === input.actorId) {
        throw new HousingReportError("You cannot report your own listing.");
      }
      const report = await tx.report.create({
        data: {
          reporterId: input.actorId,
          subjectUserId,
          targetType: "HousingListing",
          targetId: listing.id,
          reason: data.reason as ReportReason,
          details: data.details,
        },
        select: { id: true },
      });
      const mediaIds = listing.media.map(({ mediaId }) => mediaId);
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "HOUSING_CONTENT_SNAPSHOT",
          label: "Public Housing listing at time of report",
          capturedById: input.actorId,
          snapshot: {
            version: 1,
            listingId: listing.id,
            title: listing.title,
            shortDescription: listing.shortDescription,
            description: listing.description,
            listingType: listing.type,
            lifecycleStatus: listing.status,
            publisherType: listing.publisherType,
            publisherUserId: listing.publisherUserId,
            publisherOrganizationId: listing.publisherOrganizationId,
            publicLocationLabel: listing.publicLocationLabel,
            cityName: listing.city.name,
            monthlyRentMinor: listing.monthlyRentMinor,
            currency: listing.currency,
            mediaIds,
            createdAt: listing.createdAt.toISOString(),
          },
        },
      });
      if (mediaIds.length) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: mediaIds }, scanStatus: "CLEAN" },
          data: {
            retainedAt: new Date(),
            retentionReason: `Housing evidence for report ${report.id}`,
            storageDeletePending: false,
          },
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: input.actorId,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: "HousingListing",
          targetId: listing.id,
          reason: data.reason,
        },
        ...input.meta,
      });
      return { reportId: report.id, reused: false };
    });
    await Promise.all([
      trackEvent({
        name: "HOUSING_REPORT_SUBMITTED",
        userId: input.actorId,
        properties: { reused: result.reused },
      }),
      captureServerProductEvent({
        distinctId: input.actorId,
        event: PRODUCT_EVENTS.HOUSING_REPORT_SUBMITTED,
        properties: { reused: result.reused },
      }),
    ]);
    return result;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.report.findFirst({
        where: {
          reporterId: input.actorId,
          targetType: "HousingListing",
          targetId: input.listingId,
          status: { in: ["OPEN", "REVIEWING"] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}
