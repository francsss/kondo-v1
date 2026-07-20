import {
  Prisma,
  type ListingStatus,
  type ReportReason,
} from "@prisma/client";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

const ACTIVE_REPORT_STATUSES = ["OPEN", "REVIEWING"] as const;

type Actor = { id: string; role: AppRole | string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class MarketplaceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "MarketplaceError";
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

async function uniqueListingSlug(title: string) {
  const base = slugBase(title) || "listing";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const existing = await prisma.marketplaceListing.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new MarketplaceError("Could not create a unique listing URL.", 409);
}

export function assessListingFraud(input: {
  title: string;
  description: string;
  priceFen: number;
}) {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const flags: string[] = [];
  let score = 0;
  const rules: Array<[RegExp, string, number]> = [
    [/\b(deposit|advance payment|pay first)\b/i, "ADVANCE_PAYMENT", 35],
    [/\b(gift card|crypto|usdt|bitcoin)\b/i, "IRREVERSIBLE_PAYMENT", 50],
    [/\b(wechat|alipay|bank transfer)\b/i, "OFF_PLATFORM_PAYMENT", 20],
    [/\b(urgent|today only|act now)\b/i, "PRESSURE_LANGUAGE", 15],
    [/(https?:\/\/|www\.)/i, "EXTERNAL_LINK", 15],
  ];
  for (const [pattern, flag, weight] of rules) {
    if (pattern.test(text)) {
      flags.push(flag);
      score += weight;
    }
  }
  const phoneMatches = text.match(/\+?\d[\d\s-]{7,}\d/g) ?? [];
  if (phoneMatches.length > 1) {
    flags.push("MULTIPLE_CONTACT_NUMBERS");
    score += 20;
  }
  if (input.priceFen === 0) {
    flags.push("ZERO_PRICE");
    score += 10;
  }
  return { score: Math.min(100, score), flags };
}

function safeListingDto(listing: {
  id: string;
  slug: string;
  sellerId: string;
  categoryId: string;
  cityId: string;
  title: string;
  description: string;
  priceFen: number;
  isNegotiable: boolean;
  status: ListingStatus;
  publishedAt: Date | null;
  expiresAt: Date | null;
  reservedAt: Date | null;
  soldAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  images?: Array<{
    id: string;
    mediaId: string | null;
    altText: string | null;
    order: number;
  }>;
}) {
  return {
    ...listing,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    reservedAt: listing.reservedAt?.toISOString() ?? null,
    soldAt: listing.soldAt?.toISOString() ?? null,
    archivedAt: listing.archivedAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
    images: listing.images?.map((image) => ({
      ...image,
      url: image.mediaId ? `/api/media/${image.mediaId}` : null,
    })),
  };
}

async function validateReferences(categoryId: string, cityId: string) {
  const [category, city] = await Promise.all([
    prisma.marketplaceCategory.findFirst({
      where: { id: categoryId, isActive: true },
      select: { id: true },
    }),
    prisma.city.findFirst({
      where: { id: cityId, isActive: true },
      select: { id: true },
    }),
  ]);
  if (!category) throw new MarketplaceError("Category not found.", 404);
  if (!city) throw new MarketplaceError("City not found.", 404);
}

async function attachListingImages(
  tx: Prisma.TransactionClient,
  input: {
    actorId: string;
    listingId: string;
    imageIds: string[];
  },
) {
  const ids = [...new Set(input.imageIds)];
  if (ids.length !== input.imageIds.length) {
    throw new MarketplaceError("A listing cannot attach an image twice.");
  }
  const previous = await tx.listingImage.findMany({
    where: { listingId: input.listingId, mediaId: { not: null } },
    select: { mediaId: true },
  });
  const previousIds = previous
    .map(({ mediaId }) => mediaId)
    .filter((id): id is string => Boolean(id));
  await tx.listingImage.deleteMany({ where: { listingId: input.listingId } });
  if (previousIds.length) {
    await tx.mediaAsset.updateMany({
      where: {
        id: { in: previousIds.filter((id) => !ids.includes(id)) },
        attachmentType: "MARKETPLACE_LISTING",
        attachmentId: input.listingId,
        retainedAt: null,
      },
      data: { attachedAt: null, attachmentType: null, attachmentId: null },
    });
  }
  for (const [order, mediaId] of ids.entries()) {
    try {
      const media = await attachMediaAsset(tx, {
        ownerId: input.actorId,
        assetId: mediaId,
        purpose: "LISTING_IMAGE",
        attachmentType: "MARKETPLACE_LISTING",
        attachmentId: input.listingId,
      });
      await tx.listingImage.create({
        data: {
          listingId: input.listingId,
          mediaId,
          altText: media.altText,
          width: media.width,
          height: media.height,
          order,
        },
      });
    } catch (error) {
      if (error instanceof MediaError) {
        throw new MarketplaceError(error.message, error.status);
      }
      throw error;
    }
  }
}

export async function createMarketplaceListing(input: {
  actor: Actor;
  data: {
    categoryId: string;
    cityId: string;
    title: string;
    description: string;
    priceFen: number;
    isNegotiable: boolean;
    imageIds: string[];
    publish: boolean;
    expiresInDays: number;
  };
  meta?: RequestMeta;
}) {
  await validateReferences(input.data.categoryId, input.data.cityId);
  if (input.data.publish && !input.data.imageIds.length) {
    throw new MarketplaceError("Published listings require at least one image.");
  }
  const [slug, fraud] = await Promise.all([
    uniqueListingSlug(input.data.title),
    Promise.resolve(assessListingFraud(input.data)),
  ]);
  const requiresReview = fraud.score >= 70;
  const publish = input.data.publish && !requiresReview;
  const result = await prisma.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.create({
      data: {
        slug,
        sellerId: input.actor.id,
        categoryId: input.data.categoryId,
        cityId: input.data.cityId,
        title: input.data.title,
        description: input.data.description,
        priceFen: input.data.priceFen,
        isNegotiable: input.data.isNegotiable,
        status: publish ? "ACTIVE" : "DRAFT",
        publishedAt: publish ? new Date() : null,
        expiresAt: publish
          ? new Date(Date.now() + input.data.expiresInDays * 86_400_000)
          : null,
        fraudScore: fraud.score,
        fraudFlags: fraud.flags,
      },
      select: {
        id: true,
        slug: true,
        sellerId: true,
        categoryId: true,
        cityId: true,
        title: true,
        description: true,
        priceFen: true,
        isNegotiable: true,
        status: true,
        publishedAt: true,
        expiresAt: true,
        reservedAt: true,
        soldAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (input.data.imageIds.length) {
      await attachListingImages(tx, {
        actorId: input.actor.id,
        listingId: listing.id,
        imageIds: input.data.imageIds,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "LISTING_CREATED",
      entityType: "MarketplaceListing",
      entityId: listing.id,
      newValue: {
        status: listing.status,
        imageCount: input.data.imageIds.length,
        fraudScore: fraud.score,
        fraudFlags: fraud.flags,
      },
      ...input.meta,
    });
    return {
      listing: safeListingDto({
        ...listing,
        images: input.data.imageIds.map((mediaId, order) => ({
          id: `${listing.id}:${order}`,
          mediaId,
          altText: null,
          order,
        })),
      }),
      requiresReview,
    };
  });
  await trackEvent({
    name: "LISTING_CREATED",
    userId: input.actor.id,
    properties: {
      listingId: result.listing.id,
      categoryId: input.data.categoryId,
      published: publish,
    },
  });
  return result;
}

export async function updateMarketplaceListing(input: {
  actor: Actor;
  listingId: string;
  data: {
    categoryId?: string;
    cityId?: string;
    title?: string;
    description?: string;
    priceFen?: number;
    isNegotiable?: boolean;
    imageIds?: string[];
    expiresInDays?: number;
  };
  meta?: RequestMeta;
}) {
  const current = await prisma.marketplaceListing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      sellerId: true,
      categoryId: true,
      cityId: true,
      title: true,
      description: true,
      priceFen: true,
      status: true,
    },
  });
  if (!current || current.status === "REMOVED") {
    throw new MarketplaceError("Listing not found.", 404);
  }
  const admin = hasAdminPermission(input.actor.role, "MARKETPLACE_CMS_MANAGE");
  if (current.sellerId !== input.actor.id && !admin) {
    throw new MarketplaceError("Only the seller can edit this listing.", 403);
  }
  if (input.data.categoryId || input.data.cityId) {
    await validateReferences(
      input.data.categoryId ?? current.categoryId,
      input.data.cityId ?? current.cityId,
    );
  }
  if (current.status === "ACTIVE" && input.data.imageIds?.length === 0) {
    throw new MarketplaceError(
      "Published listings require at least one image.",
      409,
    );
  }
  const fraud = assessListingFraud({
    title: input.data.title ?? current.title,
    description: input.data.description ?? current.description,
    priceFen: input.data.priceFen ?? current.priceFen,
  });
  return prisma.$transaction(async (tx) => {
    const updated = await tx.marketplaceListing.update({
      where: { id: current.id },
      data: {
        categoryId: input.data.categoryId,
        cityId: input.data.cityId,
        title: input.data.title,
        description: input.data.description,
        priceFen: input.data.priceFen,
        isNegotiable: input.data.isNegotiable,
        fraudScore: fraud.score,
        fraudFlags: fraud.flags,
        fraudReviewedAt: admin ? new Date() : null,
        ...(fraud.score >= 70 && !admin && current.status === "ACTIVE"
          ? { status: "DRAFT", publishedAt: null, expiresAt: null }
          : {}),
        ...(input.data.expiresInDays && current.status === "ACTIVE"
          ? {
              expiresAt: new Date(
                Date.now() + input.data.expiresInDays * 86_400_000,
              ),
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        sellerId: true,
        categoryId: true,
        cityId: true,
        title: true,
        description: true,
        priceFen: true,
        isNegotiable: true,
        status: true,
        publishedAt: true,
        expiresAt: true,
        reservedAt: true,
        soldAt: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (input.data.imageIds) {
      await attachListingImages(tx, {
        actorId: input.actor.id,
        listingId: current.id,
        imageIds: input.data.imageIds,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "LISTING_UPDATED",
      entityType: "MarketplaceListing",
      entityId: current.id,
      newValue: {
        changedFields: Object.keys(input.data),
        fraudScore: fraud.score,
        fraudFlags: fraud.flags,
      },
      ...input.meta,
    });
    return { listing: safeListingDto(updated), requiresReview: fraud.score >= 70 };
  });
}

const SELLER_TRANSITIONS: Record<ListingStatus, readonly ListingStatus[]> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["RESERVED", "SOLD", "ARCHIVED"],
  RESERVED: ["ACTIVE", "SOLD", "ARCHIVED"],
  SOLD: ["ARCHIVED"],
  ARCHIVED: ["ACTIVE"],
  EXPIRED: ["ACTIVE", "ARCHIVED"],
  REMOVED: [],
};

export async function transitionMarketplaceListing(input: {
  actor: Actor;
  listingId: string;
  status: Extract<
    ListingStatus,
    "DRAFT" | "ACTIVE" | "RESERVED" | "SOLD" | "ARCHIVED"
  >;
  expiresInDays?: number;
  meta?: RequestMeta;
}) {
  return prisma.$transaction(async (tx) => {
    const listing = await tx.marketplaceListing.findUnique({
      where: { id: input.listingId },
      select: {
        id: true,
        slug: true,
        title: true,
        sellerId: true,
        status: true,
        fraudScore: true,
        images: { select: { id: true } },
        favorites: { select: { userId: true } },
      },
    });
    if (!listing) throw new MarketplaceError("Listing not found.", 404);
    const admin = hasAdminPermission(input.actor.role, "MARKETPLACE_CMS_MANAGE");
    if (listing.sellerId !== input.actor.id && !admin) {
      throw new MarketplaceError("Only the seller can change listing status.", 403);
    }
    if (!SELLER_TRANSITIONS[listing.status].includes(input.status) && !admin) {
      throw new MarketplaceError("Invalid listing status transition.", 409);
    }
    if (input.status === "ACTIVE") {
      if (!listing.images.length) {
        throw new MarketplaceError("Published listings require an image.", 409);
      }
      if (listing.fraudScore >= 70 && !admin) {
        throw new MarketplaceError(
          "This listing requires a safety review before publication.",
          409,
        );
      }
    }
    const now = new Date();
    const updated = await tx.marketplaceListing.update({
      where: { id: listing.id },
      data: {
        status: input.status,
        publishedAt: input.status === "ACTIVE" ? now : undefined,
        expiresAt:
          input.status === "ACTIVE"
            ? new Date(
                now.getTime() + (input.expiresInDays ?? 30) * 86_400_000,
              )
            : input.status === "DRAFT"
              ? null
              : undefined,
        reservedAt: input.status === "RESERVED" ? now : input.status === "ACTIVE" ? null : undefined,
        soldAt: input.status === "SOLD" ? now : undefined,
        archivedAt: input.status === "ARCHIVED" ? now : input.status === "ACTIVE" ? null : undefined,
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        expiresAt: true,
        reservedAt: true,
        soldAt: true,
        archivedAt: true,
      },
    });
    if (
      ["RESERVED", "SOLD"].includes(input.status) &&
      listing.favorites.length
    ) {
      for (const favorite of listing.favorites) {
        if (favorite.userId === input.actor.id) continue;
        await enqueueNotificationJobWithClient(tx, {
          recipientId: favorite.userId,
          actorId: input.actor.id,
          type: "MARKETPLACE_UPDATE",
          templateKey: "ADMIN_ANNOUNCEMENT",
          data: {
            title: `${listing.title} is ${input.status.toLowerCase()}`,
            body: "A saved Marketplace listing changed status.",
          },
          href: `/marketplace/${listing.slug}`,
          dedupeKey: `listing-status:${listing.id}:${input.status}:${favorite.userId}`,
        });
      }
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: `LISTING_${input.status}`,
      entityType: "MarketplaceListing",
      entityId: listing.id,
      oldValue: { status: listing.status },
      newValue: { status: input.status },
      ...input.meta,
    });
    return {
      listing: {
        ...updated,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
        expiresAt: updated.expiresAt?.toISOString() ?? null,
        reservedAt: updated.reservedAt?.toISOString() ?? null,
        soldAt: updated.soldAt?.toISOString() ?? null,
        archivedAt: updated.archivedAt?.toISOString() ?? null,
      },
    };
  });
}

export async function expireMarketplaceListings(now = new Date()) {
  const candidates = await prisma.marketplaceListing.findMany({
    where: {
      status: { in: ["ACTIVE", "RESERVED"] },
      expiresAt: { lte: now },
    },
    select: { id: true, sellerId: true, status: true, title: true, slug: true },
    take: 500,
  });
  let expired = 0;
  for (const listing of candidates) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.marketplaceListing.updateMany({
        where: {
          id: listing.id,
          status: listing.status,
          expiresAt: { lte: now },
        },
        data: { status: "EXPIRED" },
      });
      if (!updated.count) return;
      await enqueueNotificationJobWithClient(tx, {
        recipientId: listing.sellerId,
        type: "MARKETPLACE_UPDATE",
        templateKey: "ADMIN_ANNOUNCEMENT",
        data: {
          title: `${listing.title} expired`,
          body: "Renew or archive the listing from your seller dashboard.",
        },
        href: `/marketplace/${listing.slug}/edit`,
        dedupeKey: `listing-expired:${listing.id}`,
      });
      await writeAuditLogWithClient(tx, {
        action: "LISTING_EXPIRED",
        entityType: "MarketplaceListing",
        entityId: listing.id,
        oldValue: { status: listing.status },
        newValue: { status: "EXPIRED" },
      });
      expired += 1;
    });
  }
  return { examined: candidates.length, expired };
}

export async function createOrReuseListingReport(input: {
  actor: Actor;
  listingId: string;
  reason: ReportReason;
  details?: string;
  meta?: RequestMeta;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: "MarketplaceListing",
          targetId: input.listingId,
          status: { in: [...ACTIVE_REPORT_STATUSES] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
      const listing = await tx.marketplaceListing.findFirst({
        where: {
          id: input.listingId,
          status: "ACTIVE",
          expiresAt: { gt: new Date() },
          category: { isActive: true },
        },
        select: {
          id: true,
          title: true,
          description: true,
          priceFen: true,
          isNegotiable: true,
          status: true,
          sellerId: true,
          createdAt: true,
          city: { select: { name: true } },
          category: { select: { name: true } },
          seller: {
            select: { firstName: true, lastName: true, username: true },
          },
          images: {
            where: { mediaId: { not: null } },
            select: { mediaId: true },
          },
        },
      });
      if (!listing) throw new MarketplaceError("Listing not found.", 404);
      const mediaIds = listing.images
        .map(({ mediaId }) => mediaId)
        .filter((id): id is string => Boolean(id));
      const report = await tx.report.create({
        data: {
          reporterId: input.actor.id,
          subjectUserId: listing.sellerId,
          targetType: "MarketplaceListing",
          targetId: listing.id,
          reason: input.reason,
          details: input.details,
        },
        select: { id: true },
      });
      await tx.reportEvidence.create({
        data: {
          reportId: report.id,
          kind: "MARKETPLACE_LISTING_SNAPSHOT",
          label: "Marketplace listing at time of report",
          snapshot: {
            version: 1,
            listingId: listing.id,
            sellerId: listing.sellerId,
            sellerName: `${listing.seller.firstName} ${listing.seller.lastName}`,
            sellerUsername: listing.seller.username,
            title: listing.title,
            description: listing.description,
            priceFen: listing.priceFen,
            isNegotiable: listing.isNegotiable,
            status: listing.status,
            cityName: listing.city.name,
            categoryName: listing.category.name,
            mediaIds,
            createdAt: listing.createdAt.toISOString(),
          },
          capturedById: input.actor.id,
        },
      });
      if (mediaIds.length) {
        await tx.mediaAsset.updateMany({
          where: { id: { in: mediaIds }, scanStatus: "CLEAN" },
          data: {
            retainedAt: new Date(),
            retentionReason: `Marketplace evidence for report ${report.id}`,
            storageDeletePending: false,
          },
        });
      }
      await writeAuditLogWithClient(tx, {
        actorId: input.actor.id,
        action: "REPORT_CREATED",
        entityType: "Report",
        entityId: report.id,
        newValue: {
          targetType: "MarketplaceListing",
          targetId: listing.id,
          subjectUserId: listing.sellerId,
          reason: input.reason,
        },
        ...input.meta,
      });
      return { reportId: report.id, reused: false };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await prisma.report.findFirst({
        where: {
          reporterId: input.actor.id,
          targetType: "MarketplaceListing",
          targetId: input.listingId,
          status: { in: [...ACTIVE_REPORT_STATUSES] },
        },
        select: { id: true },
      });
      if (existing) return { reportId: existing.id, reused: true };
    }
    throw error;
  }
}

export async function listSellerListings(
  actor: Actor,
  input: { page?: number; pageSize?: number; status?: ListingStatus } = {},
) {
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const where = { sellerId: actor.id, status: input.status };
  const [total, listings] = await Promise.all([
    prisma.marketplaceListing.count({ where }),
    prisma.marketplaceListing.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        priceFen: true,
        status: true,
        expiresAt: true,
        updatedAt: true,
        fraudScore: true,
        fraudFlags: true,
        images: {
          orderBy: { order: "asc" },
          take: 1,
          select: { mediaId: true, altText: true },
        },
        _count: { select: { favorites: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: listings.map((listing) => ({
      ...listing,
      expiresAt: listing.expiresAt?.toISOString() ?? null,
      updatedAt: listing.updatedAt.toISOString(),
      image: listing.images[0] ?? null,
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function listAdminListings(
  actor: Actor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: ListingStatus;
    flagged?: boolean;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "MARKETPLACE_CMS_VIEW")) {
    throw new MarketplaceError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const where: Prisma.MarketplaceListingWhereInput = {
    status: input.status,
    ...(input.flagged ? { fraudScore: { gte: 40 } } : {}),
    ...(input.query
      ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
            {
              seller: {
                OR: [
                  { email: { contains: input.query, mode: "insensitive" } },
                  { firstName: { contains: input.query, mode: "insensitive" } },
                  { lastName: { contains: input.query, mode: "insensitive" } },
                ],
              },
            },
          ],
        }
      : {}),
  };
  const [total, listings] = await Promise.all([
    prisma.marketplaceListing.count({ where }),
    prisma.marketplaceListing.findMany({
      where,
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        priceFen: true,
        fraudScore: true,
        fraudFlags: true,
        expiresAt: true,
        updatedAt: true,
        seller: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        category: { select: { name: true } },
        city: { select: { name: true } },
        _count: { select: { favorites: true } },
      },
      orderBy: [{ fraudScore: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    records: listings.map((listing) => ({
      ...listing,
      seller: {
        ...listing.seller,
        fullName: `${listing.seller.firstName} ${listing.seller.lastName}`,
      },
      expiresAt: listing.expiresAt?.toISOString() ?? null,
      updatedAt: listing.updatedAt.toISOString(),
    })),
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminListing(actor: Actor, listingId: string) {
  if (!hasAdminPermission(actor.role, "MARKETPLACE_CMS_VIEW")) {
    throw new MarketplaceError("Access denied.", 403);
  }
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceFen: true,
      isNegotiable: true,
      status: true,
      fraudScore: true,
      fraudFlags: true,
      fraudReviewedAt: true,
      publishedAt: true,
      expiresAt: true,
      reservedAt: true,
      soldAt: true,
      archivedAt: true,
      removedAt: true,
      createdAt: true,
      updatedAt: true,
      seller: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      category: true,
      city: { select: { id: true, name: true } },
      images: {
        orderBy: { order: "asc" },
        select: { id: true, mediaId: true, objectKey: true, altText: true, order: true },
      },
      _count: { select: { favorites: true } },
    },
  });
  if (!listing) return null;
  return {
    ...listing,
    seller: {
      ...listing.seller,
      fullName: `${listing.seller.firstName} ${listing.seller.lastName}`,
    },
    images: listing.images.map((image) => ({
      id: image.id,
      mediaId: image.mediaId,
      altText: image.altText,
      order: image.order,
      legacy: Boolean(image.objectKey && !image.mediaId),
    })),
    fraudReviewedAt: listing.fraudReviewedAt?.toISOString() ?? null,
    publishedAt: listing.publishedAt?.toISOString() ?? null,
    expiresAt: listing.expiresAt?.toISOString() ?? null,
    reservedAt: listing.reservedAt?.toISOString() ?? null,
    soldAt: listing.soldAt?.toISOString() ?? null,
    archivedAt: listing.archivedAt?.toISOString() ?? null,
    removedAt: listing.removedAt?.toISOString() ?? null,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString(),
  };
}

export async function updateListingAsAdmin(input: {
  actor: Actor;
  listingId: string;
  status?: ListingStatus;
  fraudReviewed?: boolean;
  moderationNote?: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "MARKETPLACE_CMS_MANAGE")) {
    throw new MarketplaceError("Access denied.", 403);
  }
  if (
    input.status === undefined &&
    input.fraudReviewed === undefined &&
    !input.moderationNote
  ) {
    throw new MarketplaceError("No listing changes were provided.");
  }
  return prisma.$transaction(async (tx) => {
    const current = await tx.marketplaceListing.findUnique({
      where: { id: input.listingId },
      select: {
        id: true,
        status: true,
        fraudScore: true,
        fraudFlags: true,
        fraudReviewedAt: true,
        category: { select: { isActive: true } },
        _count: { select: { images: true } },
      },
    });
    if (!current) throw new MarketplaceError("Listing not found.", 404);
    if (input.status === "ACTIVE" && current._count.images === 0) {
      throw new MarketplaceError(
        "Published listings require at least one image.",
        409,
      );
    }
    if (input.status === "ACTIVE" && !current.category.isActive) {
      throw new MarketplaceError(
        "Activate the listing category before publication.",
        409,
      );
    }
    if (
      input.status === "ACTIVE" &&
      current.fraudScore >= 70 &&
      !input.fraudReviewed &&
      !current.fraudReviewedAt
    ) {
      throw new MarketplaceError(
        "Review the fraud signals before publication.",
        409,
      );
    }
    const now = new Date();
    const updated = await tx.marketplaceListing.update({
      where: { id: current.id },
      data: {
        status: input.status,
        fraudReviewedAt:
          input.fraudReviewed === undefined
            ? undefined
            : input.fraudReviewed
              ? now
              : null,
        moderatedAt: now,
        publishedAt: input.status === "ACTIVE" ? now : undefined,
        expiresAt:
          input.status === "ACTIVE"
            ? new Date(now.getTime() + 30 * 86_400_000)
            : undefined,
        removedAt:
          input.status === "REMOVED"
            ? now
            : input.status
              ? null
              : undefined,
        archivedAt: input.status === "ARCHIVED" ? now : undefined,
      },
      select: {
        id: true,
        status: true,
        fraudScore: true,
        fraudFlags: true,
        fraudReviewedAt: true,
        updatedAt: true,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "LISTING_ADMIN_UPDATED",
      entityType: "MarketplaceListing",
      entityId: current.id,
      oldValue: current,
      newValue: {
        ...updated,
        moderationNote: input.moderationNote ?? null,
      },
      ...input.meta,
    });
    return {
      listing: {
        ...updated,
        fraudReviewedAt: updated.fraudReviewedAt?.toISOString() ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  });
}

export async function listMarketplaceCategories(includeInactive = false) {
  return prisma.marketplaceCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      icon: true,
      order: true,
      isActive: true,
      _count: { select: { listings: true } },
    },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

export async function upsertMarketplaceCategory(input: {
  actor: Actor;
  categoryId?: string;
  data: {
    slug: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    order: number;
    isActive: boolean;
  };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "MARKETPLACE_CMS_MANAGE")) {
    throw new MarketplaceError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const category = input.categoryId
      ? await tx.marketplaceCategory.update({
          where: { id: input.categoryId },
          data: input.data,
        })
      : await tx.marketplaceCategory.create({ data: input.data });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: input.categoryId
        ? "MARKETPLACE_CATEGORY_UPDATED"
        : "MARKETPLACE_CATEGORY_CREATED",
      entityType: "MarketplaceCategory",
      entityId: category.id,
      newValue: {
        name: category.name,
        slug: category.slug,
        isActive: category.isActive,
      },
      ...input.meta,
    });
    return { category };
  });
}

export async function deleteMarketplaceCategory(input: {
  actor: Actor;
  categoryId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "MARKETPLACE_CMS_MANAGE")) {
    throw new MarketplaceError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const category = await tx.marketplaceCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true, _count: { select: { listings: true } } },
    });
    if (!category) throw new MarketplaceError("Category not found.", 404);
    if (category._count.listings) {
      throw new MarketplaceError(
        "Deactivate categories that are used by listings.",
        409,
      );
    }
    await tx.marketplaceCategory.delete({ where: { id: category.id } });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "MARKETPLACE_CATEGORY_DELETED",
      entityType: "MarketplaceCategory",
      entityId: category.id,
      ...input.meta,
    });
    return { deleted: true };
  });
}
