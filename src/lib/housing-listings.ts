import { randomUUID } from "node:crypto";
import type {
  HousingListingStatus,
  HousingListingType,
  Prisma,
} from "@prisma/client";
import type { z } from "zod";
import { housingListingInputSchema } from "@/features/housing/schemas";
import {
  housingListingTypeMetadata,
  PERSONAL_HOUSING_LISTING_TYPES,
} from "@/features/housing/registry";
import { trackEvent } from "@/lib/analytics";
import { writeAuditLogWithClient } from "@/lib/audit";
import { revalidateHousing } from "@/lib/housing-cache";
import {
  assertHousingListingTransition,
  housingListingStatusTimestamp,
  type HousingLifecycleActor,
} from "@/lib/housing-lifecycle";
import { privacySafeHousingCoordinate } from "@/lib/housing-location";
import {
  assertHousingListingOwner,
  canPublishPersonalHousingType,
  HousingAccessError,
  requireOrganizationHousingPermission,
} from "@/lib/housing-permissions";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type ListingInput = z.infer<typeof housingListingInputSchema>;
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export class HousingListingError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingListingError";
  }
}

export const publicHousingListingSelect = {
  id: true,
  slug: true,
  type: true,
  status: true,
  title: true,
  shortDescription: true,
  description: true,
  houseRules: true,
  neighborhoodContext: true,
  transportContext: true,
  universityContext: true,
  district: true,
  publicLocationLabel: true,
  publicLatitude: true,
  publicLongitude: true,
  locationPrivacy: true,
  monthlyRentMinor: true,
  currency: true,
  depositMinor: true,
  utilitiesMinor: true,
  agencyFeeMinor: true,
  serviceFeeMinor: true,
  otherCostsDescription: true,
  paymentPeriod: true,
  negotiable: true,
  bedrooms: true,
  bathrooms: true,
  sizeSquareMeters: true,
  furnishing: true,
  floor: true,
  occupancy: true,
  availablePlaces: true,
  availableFrom: true,
  leaseEnd: true,
  minimumStayMonths: true,
  maximumStayMonths: true,
  smokingPolicy: true,
  petPolicy: true,
  genderPreference: true,
  accessibilityDetails: true,
  contactPreference: true,
  publishedAt: true,
  updatedAt: true,
  publisherType: true,
  publisherUserId: true,
  publisherOrganizationId: true,
  city: { select: { id: true, slug: true, name: true, province: true } },
  country: { select: { id: true, code: true, name: true } },
  university: { select: { id: true, slug: true, name: true, shortName: true } },
  publisherUser: {
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      avatarMediaId: true,
      officialProfileStatus: true,
      officialOrganizationName: true,
    },
  },
  publisherOrganization: {
    select: {
      id: true,
      slug: true,
      publicName: true,
      logoMediaId: true,
      verificationStatus: true,
      isOfficialPartner: true,
      publicProfileStatus: true,
    },
  },
  media: {
    where: {
      kind: { in: ["COVER", "GALLERY", "FLOOR_PLAN"] },
      media: { status: "ACTIVE", scanStatus: "CLEAN" },
    },
    orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      mediaId: true,
      kind: true,
      caption: true,
      altText: true,
      sortOrder: true,
      isCover: true,
    },
  },
  amenities: {
    orderBy: { amenityKey: "asc" },
    select: { amenityKey: true },
  },
  _count: { select: { savedBy: true, inquiries: true } },
} satisfies Prisma.HousingListingSelect;

export type PublicHousingListingRecord = Prisma.HousingListingGetPayload<{
  select: typeof publicHousingListingSelect;
}>;

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function serializePublicHousingListing(
  listing: PublicHousingListingRecord,
) {
  return {
    id: listing.id,
    slug: listing.slug,
    type: listing.type,
    typeLabel: housingListingTypeMetadata(listing.type).label,
    title: listing.title,
    shortDescription: listing.shortDescription,
    description: listing.description,
    houseRules: listing.houseRules,
    neighborhoodContext: listing.neighborhoodContext,
    transportContext: listing.transportContext,
    universityContext: listing.universityContext,
    location: {
      city: listing.city,
      country: listing.country,
      district: listing.district,
      university: listing.university,
      label: listing.publicLocationLabel,
      privacy: listing.locationPrivacy,
      mapPoint:
        listing.publicLatitude != null && listing.publicLongitude != null
          ? {
              lat: Number(listing.publicLatitude),
              lng: Number(listing.publicLongitude),
            }
          : null,
    },
    price: {
      monthlyRentMinor: listing.monthlyRentMinor,
      currency: listing.currency,
      depositMinor: listing.depositMinor,
      utilitiesMinor: listing.utilitiesMinor,
      agencyFeeMinor: listing.agencyFeeMinor,
      serviceFeeMinor: listing.serviceFeeMinor,
      otherCostsDescription: listing.otherCostsDescription,
      paymentPeriod: listing.paymentPeriod,
      negotiable: listing.negotiable,
    },
    property: {
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      sizeSquareMeters: listing.sizeSquareMeters,
      furnishing: listing.furnishing,
      floor: listing.floor,
      occupancy: listing.occupancy,
      availablePlaces: listing.availablePlaces,
      smokingPolicy: listing.smokingPolicy,
      petPolicy: listing.petPolicy,
      genderPreference: listing.genderPreference,
      accessibilityDetails: listing.accessibilityDetails,
    },
    availability: {
      availableFrom: date(listing.availableFrom),
      leaseEnd: date(listing.leaseEnd),
      minimumStayMonths: listing.minimumStayMonths,
      maximumStayMonths: listing.maximumStayMonths,
    },
    amenities: listing.amenities.map(({ amenityKey }) => amenityKey),
    media: listing.media.map((item) => ({
      ...item,
      url: `/api/media/${item.mediaId}`,
    })),
    publisher:
      listing.publisherType === "ORGANIZATION"
        ? {
            type: "ORGANIZATION" as const,
            id: listing.publisherOrganization!.id,
            name: listing.publisherOrganization!.publicName,
            href:
              listing.publisherOrganization!.publicProfileStatus === "PUBLISHED"
                ? `/organizations/${listing.publisherOrganization!.slug}`
                : null,
            avatarUrl: listing.publisherOrganization!.logoMediaId
              ? `/api/media/${listing.publisherOrganization!.logoMediaId}`
              : null,
            verified:
              listing.publisherOrganization!.verificationStatus === "VERIFIED",
            partner:
              listing.publisherOrganization!.verificationStatus ===
                "VERIFIED" && listing.publisherOrganization!.isOfficialPartner,
          }
        : {
            type: "PERSONAL" as const,
            id: listing.publisherUser!.id,
            name: `${listing.publisherUser!.firstName} ${listing.publisherUser!.lastName}`,
            href: listing.publisherUser!.username
              ? `/profile/${listing.publisherUser!.username}`
              : null,
            avatarUrl: listing.publisherUser!.avatarMediaId
              ? `/api/media/${listing.publisherUser!.avatarMediaId}`
              : null,
            verified:
              listing.publisherUser!.officialProfileStatus === "APPROVED",
            partner: false,
          },
    contactPreference: listing.contactPreference,
    savedCount: listing._count.savedBy,
    inquiryCount: listing._count.inquiries,
    publishedAt: date(listing.publishedAt),
    updatedAt: date(listing.updatedAt),
  };
}

function slugify(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${base || "housing"}-${randomUUID().slice(0, 8)}`;
}

async function validateHousingReferences(input: ListingInput) {
  const [country, city, university] = await Promise.all([
    prisma.country.findFirst({
      where: { id: input.countryId, isActive: true },
      select: { id: true },
    }),
    prisma.city.findFirst({
      where: {
        id: input.cityId,
        countryId: input.countryId,
        isActive: true,
      },
      select: { id: true, slug: true },
    }),
    input.universityId
      ? prisma.university.findFirst({
          where: {
            id: input.universityId,
            cityId: input.cityId,
            isActive: true,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!country || !city || (input.universityId && !university)) {
    throw new HousingListingError(
      "Choose a valid country, city and university combination.",
    );
  }
  return { city };
}

async function enforcePersonalPublishingPolicy(
  userId: string,
  type: HousingListingType,
) {
  if (!canPublishPersonalHousingType(type)) {
    throw new HousingAccessError(
      "This listing type requires an Organization Housing workspace.",
      403,
    );
  }
  const activeCount = await prisma.housingListing.count({
    where: {
      publisherUserId: userId,
      status: { in: ["PENDING_REVIEW", "PUBLISHED", "PAUSED"] },
    },
  });
  if (activeCount >= 3) {
    throw new HousingAccessError(
      "Personal accounts can manage up to three active Housing listings. Create an Organization for commercial publishing.",
      409,
    );
  }
}

export async function createHousingListing(input: {
  actorId: string;
  data: ListingInput;
  meta?: RequestMeta;
}) {
  const data = housingListingInputSchema.parse(input.data);
  const { city } = await validateHousingReferences(data);
  if (data.publisherType === "PERSONAL") {
    await enforcePersonalPublishingPolicy(input.actorId, data.type);
  } else {
    await requireOrganizationHousingPermission({
      userId: input.actorId,
      organizationId: data.organizationId!,
      permission: "ORGANIZATION_CREATE_HOUSING",
    });
    if (!housingListingTypeMetadata(data.type).organizationAllowed) {
      throw new HousingListingError(
        "This Housing type is reserved for personal publishers.",
      );
    }
  }
  const exact =
    data.exactLatitude != null && data.exactLongitude != null
      ? { lat: data.exactLatitude, lng: data.exactLongitude }
      : null;
  const result = await prisma.$transaction(async (tx) => {
    const created = await tx.housingListing.create({
      data: {
        slug: slugify(data.title),
        publisherType: data.publisherType,
        publisherUserId:
          data.publisherType === "PERSONAL" ? input.actorId : null,
        publisherOrganizationId:
          data.publisherType === "ORGANIZATION" ? data.organizationId : null,
        createdByUserId: input.actorId,
        representativeUserId: input.actorId,
        type: data.type,
        title: data.title,
        shortDescription: data.shortDescription,
        description: data.description,
        houseRules: data.houseRules,
        neighborhoodContext: data.neighborhoodContext,
        transportContext: data.transportContext,
        universityContext: data.universityContext,
        countryId: data.countryId,
        cityId: data.cityId,
        district: data.district,
        universityId: data.universityId,
        publicLocationLabel: data.publicLocationLabel,
        privateAddress: data.privateAddress,
        exactLatitude: data.exactLatitude,
        exactLongitude: data.exactLongitude,
        locationPrivacy: data.locationPrivacy,
        monthlyRentMinor: data.monthlyRentMinor,
        currency: data.currency,
        depositMinor: data.depositMinor,
        utilitiesMinor: data.utilitiesMinor,
        agencyFeeMinor: data.agencyFeeMinor,
        serviceFeeMinor: data.serviceFeeMinor,
        otherCostsDescription: data.otherCostsDescription,
        paymentPeriod: data.paymentPeriod,
        negotiable: data.negotiable,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sizeSquareMeters: data.sizeSquareMeters,
        furnishing: data.furnishing,
        floor: data.floor,
        occupancy: data.occupancy,
        availablePlaces: data.availablePlaces,
        availableFrom: data.availableFrom,
        leaseEnd: data.leaseEnd,
        minimumStayMonths: data.minimumStayMonths,
        maximumStayMonths: data.maximumStayMonths,
        smokingPolicy: data.smokingPolicy,
        petPolicy: data.petPolicy,
        genderPreference: data.genderPreference,
        accessibilityDetails: data.accessibilityDetails,
        contactPreference: data.contactPreference,
        publicContactEnabled: data.publicContactEnabled,
        accuracyConfirmedAt: data.accuracyConfirmed ? new Date() : null,
        amenities: {
          create: [...new Set(data.amenities)].map((amenityKey) => ({
            amenityKey,
          })),
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        publisherOrganizationId: true,
      },
    });
    const publicPoint = privacySafeHousingCoordinate({
      exact,
      anchor: exact,
      listingId: created.id,
      privacy: data.locationPrivacy,
    });
    if (publicPoint) {
      await tx.housingListing.update({
        where: { id: created.id },
        data: {
          publicLatitude: publicPoint.lat,
          publicLongitude: publicPoint.lng,
        },
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      organizationId: created.publisherOrganizationId,
      action: "HOUSING_LISTING_CREATED",
      entityType: "HousingListing",
      entityId: created.id,
      newValue: {
        publisherType: data.publisherType,
        listingType: data.type,
        status: created.status,
        cityId: data.cityId,
      },
      ...input.meta,
    });
    return created;
  });
  revalidateHousing({
    listingId: result.id,
    citySlug: city.slug,
  });
  await Promise.all([
    trackEvent({
      name: "HOUSING_LISTING_CREATED",
      userId: input.actorId,
      properties: {
        publisherType: data.publisherType,
        listingType: data.type,
        cityId: data.cityId,
      },
    }),
    captureServerProductEvent({
      distinctId: input.actorId,
      event: PRODUCT_EVENTS.HOUSING_LISTING_CREATION_STARTED,
      properties: {
        publisher_type: data.publisherType,
        listing_type: data.type,
      },
    }),
  ]);
  return result;
}

export async function updateHousingListing(input: {
  actorId: string;
  listingId: string;
  data: ListingInput;
  expectedVersion?: number;
  meta?: RequestMeta;
}) {
  const data = housingListingInputSchema.parse(input.data);
  const existing = await assertHousingListingOwner({
    userId: input.actorId,
    listingId: input.listingId,
  });
  if (!["DRAFT", "PAUSED", "REJECTED", "EXPIRED"].includes(existing.status)) {
    throw new HousingListingError(
      "This listing must be paused or returned to draft before editing.",
      409,
    );
  }
  if (data.publisherType !== existing.publisherType) {
    throw new HousingListingError("A listing publisher cannot be changed.");
  }
  if (
    existing.publisherType === "ORGANIZATION" &&
    data.organizationId !== existing.publisherOrganizationId
  ) {
    throw new HousingListingError("A listing organization cannot be changed.");
  }
  if (
    existing.publisherType === "PERSONAL" &&
    !canPublishPersonalHousingType(data.type)
  ) {
    throw new HousingListingError(
      "This listing type requires an organization publisher.",
      403,
    );
  }
  await validateHousingReferences(data);
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.housingListing.updateMany({
      where: {
        id: input.listingId,
        ...(input.expectedVersion
          ? { version: input.expectedVersion }
          : undefined),
      },
      data: {
        type: data.type,
        title: data.title,
        shortDescription: data.shortDescription,
        description: data.description,
        houseRules: data.houseRules,
        neighborhoodContext: data.neighborhoodContext,
        transportContext: data.transportContext,
        universityContext: data.universityContext,
        countryId: data.countryId,
        cityId: data.cityId,
        district: data.district,
        universityId: data.universityId,
        publicLocationLabel: data.publicLocationLabel,
        privateAddress: data.privateAddress,
        exactLatitude: data.exactLatitude,
        exactLongitude: data.exactLongitude,
        locationPrivacy: data.locationPrivacy,
        monthlyRentMinor: data.monthlyRentMinor,
        currency: data.currency,
        depositMinor: data.depositMinor,
        utilitiesMinor: data.utilitiesMinor,
        agencyFeeMinor: data.agencyFeeMinor,
        serviceFeeMinor: data.serviceFeeMinor,
        otherCostsDescription: data.otherCostsDescription,
        paymentPeriod: data.paymentPeriod,
        negotiable: data.negotiable,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        sizeSquareMeters: data.sizeSquareMeters,
        furnishing: data.furnishing,
        floor: data.floor,
        occupancy: data.occupancy,
        availablePlaces: data.availablePlaces,
        availableFrom: data.availableFrom,
        leaseEnd: data.leaseEnd,
        minimumStayMonths: data.minimumStayMonths,
        maximumStayMonths: data.maximumStayMonths,
        smokingPolicy: data.smokingPolicy,
        petPolicy: data.petPolicy,
        genderPreference: data.genderPreference,
        accessibilityDetails: data.accessibilityDetails,
        contactPreference: data.contactPreference,
        publicContactEnabled: data.publicContactEnabled,
        accuracyConfirmedAt: data.accuracyConfirmed ? new Date() : null,
        publicationBlockedAt: null,
        publicationBlockReason: null,
        status:
          existing.status === "REJECTED" || existing.status === "EXPIRED"
            ? "DRAFT"
            : undefined,
        version: { increment: 1 },
      },
    });
    if (!updated.count) {
      throw new HousingListingError(
        "This listing changed in another session. Refresh and try again.",
        409,
      );
    }
    await tx.housingListingAmenity.deleteMany({
      where: { listingId: input.listingId },
    });
    if (data.amenities.length) {
      await tx.housingListingAmenity.createMany({
        data: [...new Set(data.amenities)].map((amenityKey) => ({
          listingId: input.listingId,
          amenityKey,
        })),
      });
    }
    const exact =
      data.exactLatitude != null && data.exactLongitude != null
        ? { lat: data.exactLatitude, lng: data.exactLongitude }
        : null;
    const point = privacySafeHousingCoordinate({
      exact,
      anchor: exact,
      listingId: input.listingId,
      privacy: data.locationPrivacy,
    });
    await tx.housingListing.update({
      where: { id: input.listingId },
      data: {
        publicLatitude: point?.lat ?? null,
        publicLongitude: point?.lng ?? null,
      },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      organizationId: existing.publisherOrganizationId,
      action: "HOUSING_LISTING_UPDATED",
      entityType: "HousingListing",
      entityId: input.listingId,
      newValue: {
        listingType: data.type,
        cityId: data.cityId,
        locationPrivacy: data.locationPrivacy,
      },
      ...input.meta,
    });
    return tx.housingListing.findUniqueOrThrow({
      where: { id: input.listingId },
      select: { id: true, slug: true, status: true, version: true },
    });
  });
  revalidateHousing({ listingId: input.listingId });
  return result;
}

async function assertListingReadyForReview(listingId: string) {
  const listing = await prisma.housingListing.findUnique({
    where: { id: listingId },
    select: {
      accuracyConfirmedAt: true,
      representativeUser: { select: { status: true } },
      _count: {
        select: {
          media: {
            where: {
              kind: { in: ["COVER", "GALLERY"] },
              media: { status: "ACTIVE", scanStatus: "CLEAN" },
            },
          },
        },
      },
    },
  });
  if (!listing)
    throw new HousingListingError("Housing listing not found.", 404);
  if (!listing.accuracyConfirmedAt) {
    throw new HousingListingError(
      "Confirm the listing is accurate before submission.",
    );
  }
  if (!listing._count.media) {
    throw new HousingListingError(
      "Add at least one validated Housing image before submission.",
    );
  }
  if (listing.representativeUser?.status !== "ACTIVE") {
    throw new HousingListingError(
      "Choose an active Kondo representative before submission.",
    );
  }
}

export async function transitionHousingListing(input: {
  actorId: string;
  actor: HousingLifecycleActor;
  listingId: string;
  to: HousingListingStatus;
  reason?: string | null;
  expectedVersion?: number;
  meta?: RequestMeta;
}) {
  const listing =
    input.actor === "ADMIN"
      ? await prisma.housingListing.findUnique({
          where: { id: input.listingId },
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            version: true,
            publisherType: true,
            publisherUserId: true,
            publisherOrganizationId: true,
            representativeUserId: true,
            city: { select: { slug: true } },
            publisherOrganization: { select: { slug: true } },
          },
        })
      : await (async () => {
          const owned = await assertHousingListingOwner({
            userId: input.actorId,
            listingId: input.listingId,
            permission: input.to === "PUBLISHED" ? "PUBLISH" : "EDIT",
          });
          return prisma.housingListing.findUnique({
            where: { id: owned.id },
            select: {
              id: true,
              title: true,
              type: true,
              status: true,
              version: true,
              publisherType: true,
              publisherUserId: true,
              publisherOrganizationId: true,
              representativeUserId: true,
              city: { select: { slug: true } },
              publisherOrganization: { select: { slug: true } },
            },
          });
        })();
  if (!listing)
    throw new HousingListingError("Housing listing not found.", 404);
  assertHousingListingTransition({
    from: listing.status,
    to: input.to,
    actor: input.actor,
  });
  if (input.to === "PENDING_REVIEW" || input.to === "PUBLISHED") {
    await assertListingReadyForReview(input.listingId);
  }
  if (
    input.actor !== "ADMIN" &&
    input.to === "PUBLISHED" &&
    listing.publisherType === "PERSONAL"
  ) {
    throw new HousingAccessError(
      "Personal listings require Housing review before publication.",
      403,
    );
  }
  const now = new Date();
  const expiresAt =
    input.to === "PUBLISHED"
      ? new Date(now.getTime() + 60 * 24 * 60 * 60_000)
      : undefined;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.housingListing.updateMany({
      where: {
        id: listing.id,
        status: listing.status,
        version: input.expectedVersion ?? listing.version,
      },
      data: {
        status: input.to,
        ...housingListingStatusTimestamp(input.to, now),
        expiresAt,
        moderationReason:
          input.actor === "ADMIN" && input.reason
            ? input.reason.slice(0, 1_200)
            : undefined,
        moderatedAt: input.actor === "ADMIN" ? now : undefined,
        moderatedByUserId: input.actor === "ADMIN" ? input.actorId : undefined,
        version: { increment: 1 },
      },
    });
    if (!updated.count) {
      throw new HousingListingError(
        "This listing changed in another session. Refresh and try again.",
        409,
      );
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      organizationId: listing.publisherOrganizationId,
      action: "HOUSING_LISTING_STATUS_CHANGED",
      entityType: "HousingListing",
      entityId: listing.id,
      oldValue: { status: listing.status },
      newValue: { status: input.to, reason: input.reason ?? null },
      ...input.meta,
    });
    const recipientId =
      listing.publisherType === "PERSONAL"
        ? listing.publisherUserId
        : listing.representativeUserId;
    if (recipientId && recipientId !== input.actorId) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId,
        actorId: input.actorId,
        type: "HOUSING",
        templateKey: "HOUSING_LISTING_STATUS",
        data: {
          listingTitle: listing.title,
          outcome: input.to.toLowerCase().replaceAll("_", " "),
        },
        href: `/housing/manage/${listing.id}`,
        dedupeKey: `housing-listing:${listing.id}:${input.to}:${listing.version + 1}`,
      });
    }
  });
  revalidateHousing({
    listingId: listing.id,
    organizationSlug: listing.publisherOrganization?.slug,
    citySlug: listing.city.slug,
  });
  if (input.to === "PENDING_REVIEW" || input.to === "PUBLISHED") {
    await Promise.all([
      trackEvent({
        name:
          input.to === "PUBLISHED"
            ? "HOUSING_LISTING_PUBLISHED"
            : "HOUSING_LISTING_SUBMITTED",
        userId: input.actorId,
        properties: {
          listingType: listing.type,
          publisherType: listing.publisherType,
        },
      }),
      captureServerProductEvent({
        distinctId: input.actorId,
        event:
          input.to === "PUBLISHED"
            ? PRODUCT_EVENTS.HOUSING_LISTING_PUBLISHED
            : PRODUCT_EVENTS.HOUSING_LISTING_SUBMITTED,
        properties: { publisher_type: listing.publisherType },
      }),
    ]);
  }
  return { id: listing.id, status: input.to };
}

export async function getPublicHousingListing(
  idOrSlug: string,
  viewerId?: string | null,
) {
  const listing = await prisma.housingListing.findFirst({
    where: {
      AND: [
        { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
        publicHousingListingWhere(),
      ],
    },
    select: publicHousingListingSelect,
  });
  if (!listing) return null;
  const [saved] = viewerId
    ? await Promise.all([
        prisma.housingSavedListing.findUnique({
          where: {
            userId_listingId: { userId: viewerId, listingId: listing.id },
          },
          select: { listingId: true },
        }),
        trackEvent({
          name: "HOUSING_LISTING_VIEWED",
          userId: viewerId,
          properties: {
            cityId: listing.city.id,
            listingType: listing.type,
            publisherType: listing.publisherType,
          },
        }),
      ])
    : [null];
  return {
    ...serializePublicHousingListing(listing),
    saved: Boolean(saved),
  };
}

export async function listManagedHousingListings(input: {
  userId: string;
  organizationId?: string | null;
  status?: HousingListingStatus;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 20));
  if (input.organizationId) {
    await requireOrganizationHousingPermission({
      userId: input.userId,
      organizationId: input.organizationId,
      permission: "ORGANIZATION_EDIT_HOUSING",
    });
  }
  const where: Prisma.HousingListingWhereInput = {
    ...(input.organizationId
      ? { publisherOrganizationId: input.organizationId }
      : { publisherUserId: input.userId }),
    status: input.status,
  };
  const [total, listings] = await Promise.all([
    prisma.housingListing.count({ where }),
    prisma.housingListing.findMany({
      where,
      select: {
        id: true,
        slug: true,
        type: true,
        status: true,
        title: true,
        monthlyRentMinor: true,
        currency: true,
        availableFrom: true,
        publishedAt: true,
        expiresAt: true,
        updatedAt: true,
        version: true,
        city: { select: { name: true } },
        media: {
          where: { isCover: true, kind: { not: "PROOF_DOCUMENT" } },
          select: { mediaId: true, altText: true },
          take: 1,
        },
        _count: { select: { savedBy: true, inquiries: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    listings,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export function isLegacyHousingMarketplaceCategory(slug: string) {
  return /^(housing|apartment|apartments|room|rooms|sublet|roommate|dormitory)$/i.test(
    slug.trim(),
  );
}

export async function expireHousingListings(now = new Date()) {
  const candidates = await prisma.housingListing.findMany({
    where: {
      status: { in: ["PUBLISHED", "PAUSED"] },
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      status: true,
      publisherUserId: true,
      representativeUserId: true,
      city: { select: { slug: true } },
      publisherOrganization: { select: { slug: true } },
    },
    take: 500,
  });
  let expired = 0;
  for (const listing of candidates) {
    await prisma.$transaction(async (tx) => {
      const changed = await tx.housingListing.updateMany({
        where: {
          id: listing.id,
          status: listing.status,
          expiresAt: { lte: now },
        },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
      if (!changed.count) return;
      await writeAuditLogWithClient(tx, {
        action: "HOUSING_LISTING_EXPIRED",
        entityType: "HousingListing",
        entityId: listing.id,
        oldValue: { status: listing.status },
        newValue: { status: "EXPIRED" },
      });
      const recipientId =
        listing.publisherUserId ?? listing.representativeUserId;
      if (recipientId) {
        await enqueueNotificationJobWithClient(tx, {
          recipientId,
          type: "HOUSING",
          templateKey: "HOUSING_LISTING_STATUS",
          data: { listingTitle: "Your Housing listing", outcome: "expired" },
          href: `/housing/manage/${listing.id}`,
          dedupeKey: `housing-listing:${listing.id}:expired`,
        });
      }
      expired += 1;
    });
    revalidateHousing({
      listingId: listing.id,
      citySlug: listing.city.slug,
      organizationSlug: listing.publisherOrganization?.slug,
    });
  }
  return { examined: candidates.length, expired };
}

export function allowedPersonalHousingTypes() {
  return [...PERSONAL_HOUSING_LISTING_TYPES];
}
