import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { housingSearchSchema } from "@/features/housing/schemas";
import {
  publicHousingListingSelect,
  serializePublicHousingListing,
} from "@/lib/housing-listings";
import { publicHousingListingWhere } from "@/lib/housing-visibility";
import { prisma } from "@/lib/prisma";

type HousingSearchInput = z.infer<typeof housingSearchSchema>;

type OffsetCursor = { offset: number };

function encodeCursor(value: OffsetCursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(value?: string) {
  if (!value) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Number.isInteger(parsed.offset) &&
      parsed.offset >= 0 &&
      parsed.offset <= 10_000
    ) {
      return parsed.offset as number;
    }
  } catch {
    // A malformed cursor is intentionally normalized to the first page.
  }
  return 0;
}

export function housingSearchWhere(
  input: HousingSearchInput,
  now = new Date(),
): Prisma.HousingListingWhereInput {
  const term = input.q?.trim();
  return {
    ...publicHousingListingWhere(now),
    cityId: input.cityId,
    district: input.district
      ? { contains: input.district, mode: "insensitive" }
      : undefined,
    universityId: input.universityId,
    publisherOrganizationId: input.organizationId,
    type: input.types.length ? { in: input.types } : undefined,
    currency: input.currency?.toUpperCase(),
    monthlyRentMinor: {
      gte: input.minimumRentMinor,
      lte: input.maximumRentMinor,
    },
    bedrooms: input.bedrooms == null ? undefined : { gte: input.bedrooms },
    availableFrom: input.availableFrom
      ? { lte: input.availableFrom }
      : undefined,
    furnishing:
      input.furnished === true
        ? { in: ["FURNISHED", "PARTLY_FURNISHED"] }
        : undefined,
    petPolicy: input.petPolicy,
    smokingPolicy: input.smokingPolicy,
    publisherType:
      input.publisher === "PERSONAL"
        ? "PERSONAL"
        : input.publisher === "ORGANIZATION" ||
            input.publisher === "VERIFIED_ORGANIZATION"
          ? "ORGANIZATION"
          : undefined,
    publisherOrganization:
      input.publisher === "VERIFIED_ORGANIZATION"
        ? { verificationStatus: "VERIFIED" }
        : undefined,
    AND: [
      ...(publicHousingListingWhere(now)
        .AND as Prisma.HousingListingWhereInput[]),
      ...(input.minimumStayMonths
        ? [
            {
              OR: [
                { minimumStayMonths: null },
                { minimumStayMonths: { lte: input.minimumStayMonths } },
              ],
            } satisfies Prisma.HousingListingWhereInput,
          ]
        : []),
      ...input.amenities.map(
        (amenityKey) =>
          ({
            amenities: { some: { amenityKey } },
          }) satisfies Prisma.HousingListingWhereInput,
      ),
      ...(term
        ? [
            {
              OR: [
                { title: { contains: term, mode: "insensitive" } },
                {
                  shortDescription: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                { district: { contains: term, mode: "insensitive" } },
                {
                  publicLocationLabel: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
                { city: { name: { contains: term, mode: "insensitive" } } },
                {
                  university: {
                    name: { contains: term, mode: "insensitive" },
                  },
                },
              ],
            } satisfies Prisma.HousingListingWhereInput,
          ]
        : []),
    ],
  };
}

function housingOrderBy(
  sort: HousingSearchInput["sort"],
): Prisma.HousingListingOrderByWithRelationInput[] {
  if (sort === "PRICE_ASC") {
    return [{ monthlyRentMinor: "asc" }, { id: "asc" }];
  }
  if (sort === "PRICE_DESC") {
    return [{ monthlyRentMinor: "desc" }, { id: "desc" }];
  }
  if (sort === "AVAILABLE") {
    return [{ availableFrom: "asc" }, { publishedAt: "desc" }, { id: "desc" }];
  }
  return [{ publishedAt: "desc" }, { updatedAt: "desc" }, { id: "desc" }];
}

export async function searchHousing(rawInput: HousingSearchInput) {
  const input = housingSearchSchema.parse(rawInput);
  const where = housingSearchWhere(input);
  const offset = decodeCursor(input.cursor);
  const [total, listings] = await Promise.all([
    prisma.housingListing.count({ where }),
    prisma.housingListing.findMany({
      where,
      select: publicHousingListingSelect,
      orderBy: housingOrderBy(input.sort),
      skip: offset,
      take: input.limit,
    }),
  ]);
  const nextOffset = offset + listings.length;
  return {
    items: listings.map(serializePublicHousingListing),
    total,
    nextCursor:
      nextOffset < total ? encodeCursor({ offset: nextOffset }) : null,
    limit: input.limit,
  };
}

export async function listHousingMapPoints(input: {
  cityId?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  limit?: number;
}) {
  const limit = Math.min(120, Math.max(1, input.limit ?? 80));
  const bounded =
    [input.north, input.south, input.east, input.west].every(
      (value) => typeof value === "number" && Number.isFinite(value),
    ) &&
    input.north! > input.south! &&
    input.east! > input.west!;
  const listings = await prisma.housingListing.findMany({
    where: {
      ...publicHousingListingWhere(),
      cityId: input.cityId,
      publicLatitude: bounded
        ? { gte: input.south, lte: input.north }
        : { not: null },
      publicLongitude: bounded
        ? { gte: input.west, lte: input.east }
        : { not: null },
      locationPrivacy: { not: "DISTRICT_ONLY" },
    },
    select: {
      id: true,
      title: true,
      type: true,
      monthlyRentMinor: true,
      currency: true,
      publicLatitude: true,
      publicLongitude: true,
      publicLocationLabel: true,
      city: { select: { name: true } },
      media: {
        where: { isCover: true, kind: { not: "PROOF_DOCUMENT" } },
        select: { mediaId: true, altText: true },
        take: 1,
      },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return listings.map((listing) => ({
    id: listing.id,
    title: listing.title,
    type: listing.type,
    price: {
      amountMinor: listing.monthlyRentMinor,
      currency: listing.currency,
    },
    locationLabel: listing.publicLocationLabel,
    cityName: listing.city.name,
    coordinate: {
      lat: Number(listing.publicLatitude),
      lng: Number(listing.publicLongitude),
    },
    cover: listing.media[0]
      ? {
          url: `/api/media/${listing.media[0].mediaId}`,
          altText: listing.media[0].altText,
        }
      : null,
    href: `/housing/listings/${listing.id}`,
  }));
}

export async function getHousingRecommendations(userId: string, limit = 8) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      cityId: true,
      universityId: true,
      targetCities: { select: { cityId: true }, take: 3 },
      targetUniversities: { select: { universityId: true }, take: 3 },
    },
  });
  if (!user) return [];
  const cityIds = [
    user.cityId,
    ...user.targetCities.map(({ cityId }) => cityId),
  ].filter((value): value is string => Boolean(value));
  const universityIds = [
    user.universityId,
    ...user.targetUniversities.map(({ universityId }) => universityId),
  ].filter((value): value is string => Boolean(value));
  if (!cityIds.length && !universityIds.length) return [];

  const listings = await prisma.housingListing.findMany({
    where: {
      AND: [
        publicHousingListingWhere(),
        {
          OR: [
            ...(cityIds.length ? [{ cityId: { in: cityIds } }] : []),
            ...(universityIds.length
              ? [{ universityId: { in: universityIds } }]
              : []),
          ],
        },
      ],
    },
    select: publicHousingListingSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: Math.min(12, Math.max(1, limit)),
  });
  return listings.map((listing) => ({
    listing: serializePublicHousingListing(listing),
    reasons: [
      ...(listing.university?.id &&
      universityIds.includes(listing.university.id)
        ? ["Near a university in your profile"]
        : []),
      ...(cityIds.includes(listing.city.id) ? ["In a city you selected"] : []),
      ...(listing.availableFrom <= new Date()
        ? ["Available now"]
        : ["Upcoming availability"]),
    ].slice(0, 3),
  }));
}
