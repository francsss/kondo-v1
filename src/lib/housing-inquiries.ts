import { writeAuditLogWithClient } from "@/lib/audit";
import { trackEvent } from "@/lib/analytics";
import { housingInquirySchema } from "@/features/housing/schemas";
import { revalidateHousing } from "@/lib/housing-cache";
import { createDirectMessage } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { publicHousingListingWhere } from "@/lib/housing-visibility";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export class HousingInquiryError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingInquiryError";
  }
}

export async function createHousingInquiry(input: {
  actorId: string;
  listingId: string;
  data: Parameters<typeof housingInquirySchema.parse>[0];
  meta?: RequestMeta;
}) {
  const data = housingInquirySchema.parse(input.data);
  const listing = await prisma.housingListing.findFirst({
    where: { id: input.listingId, ...publicHousingListingWhere() },
    select: {
      id: true,
      representativeUserId: true,
      publisherUserId: true,
      publisherOrganizationId: true,
    },
  });
  if (!listing)
    throw new HousingInquiryError("Housing listing not found.", 404);
  let recipientId = listing.representativeUserId ?? listing.publisherUserId;
  if (listing.publisherOrganizationId) {
    const representativeMembership = recipientId
      ? await prisma.organizationMembership.findFirst({
          where: {
            organizationId: listing.publisherOrganizationId,
            userId: recipientId,
            status: "ACTIVE",
            user: { status: "ACTIVE" },
          },
          select: { userId: true },
        })
      : null;
    if (!representativeMembership) {
      const fallback = await prisma.organizationMembership.findFirst({
        where: {
          organizationId: listing.publisherOrganizationId,
          status: "ACTIVE",
          role: { in: ["OWNER", "ADMIN", "EDITOR", "MANAGER"] },
          user: { status: "ACTIVE" },
        },
        select: { userId: true },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      });
      recipientId = fallback?.userId ?? null;
    }
  }
  if (!recipientId || recipientId === input.actorId) {
    throw new HousingInquiryError(
      recipientId
        ? "You cannot inquire about your own listing."
        : "This listing is temporarily unavailable for inquiries.",
      409,
    );
  }
  const recent = await prisma.housingInquiry.findFirst({
    where: {
      listingId: listing.id,
      requesterUserId: input.actorId,
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
    select: { id: true },
  });
  if (recent) {
    throw new HousingInquiryError(
      "Your inquiry was already sent. Please wait before sending another.",
      429,
    );
  }
  const message = await createDirectMessage({
    senderId: input.actorId,
    recipientId,
    body: data.message,
    sourceType: "HOUSING_LISTING",
    sourceId: listing.id,
  });
  const inquiry = await prisma.$transaction(async (tx) => {
    const created = await tx.housingInquiry.create({
      data: {
        listingId: listing.id,
        requesterUserId: input.actorId,
        recipientUserId: recipientId,
        organizationId: listing.publisherOrganizationId,
        conversationId: message.conversationId,
        topic: data.topic,
      },
      select: {
        id: true,
        status: true,
        conversationId: true,
        createdAt: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      organizationId: listing.publisherOrganizationId,
      action: "HOUSING_INQUIRY_CREATED",
      entityType: "HousingInquiry",
      entityId: created.id,
      newValue: { listingId: listing.id, topic: data.topic },
      ...input.meta,
    });
    return created;
  });
  revalidateHousing({ listingId: listing.id });
  await trackEvent({
    name: "HOUSING_INQUIRY_SENT",
    userId: input.actorId,
    properties: { listingId: listing.id, topic: data.topic },
  });
  return {
    ...inquiry,
    createdAt: inquiry.createdAt.toISOString(),
  };
}

export async function listHousingInquiries(input: {
  actorId: string;
  listingId?: string;
}) {
  return prisma.housingInquiry.findMany({
    where: {
      recipientUserId: input.actorId,
      listingId: input.listingId,
    },
    select: {
      id: true,
      listingId: true,
      status: true,
      topic: true,
      conversationId: true,
      createdAt: true,
      requester: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatarMediaId: true,
        },
      },
      listing: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
