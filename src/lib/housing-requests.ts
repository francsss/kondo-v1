import type { HousingRequestStatus, Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { revalidateHousing } from "@/lib/housing-cache";
import { housingRequestInputSchema } from "@/features/housing/schemas";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };
type HousingRequestInput = Parameters<
  typeof housingRequestInputSchema.parse
>[0];

export class HousingRequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "HousingRequestError";
  }
}

const requestSelect = {
  id: true,
  userId: true,
  status: true,
  visibility: true,
  preferredDistrict: true,
  moveInDate: true,
  stayDurationMonths: true,
  minimumBudgetMinor: true,
  maximumBudgetMinor: true,
  currency: true,
  preferredListingTypes: true,
  roomPreference: true,
  roommateOpen: true,
  requiredAmenities: true,
  preferredCommute: true,
  description: true,
  publishedAt: true,
  expiresAt: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  city: { select: { id: true, name: true, slug: true } },
  university: { select: { id: true, name: true, slug: true } },
  user: {
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
} satisfies Prisma.HousingRequestSelect;

type RequestRecord = Prisma.HousingRequestGetPayload<{
  select: typeof requestSelect;
}>;

function date(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function serializeHousingRequest(
  request: RequestRecord,
  viewerId?: string | null,
) {
  const owner = request.userId === viewerId;
  return {
    id: request.id,
    status: request.status,
    visibility: request.visibility,
    preferredDistrict: request.preferredDistrict,
    moveInDate: date(request.moveInDate),
    stayDurationMonths: request.stayDurationMonths,
    minimumBudgetMinor: request.minimumBudgetMinor,
    maximumBudgetMinor: request.maximumBudgetMinor,
    currency: request.currency,
    preferredListingTypes: request.preferredListingTypes,
    roomPreference: request.roomPreference,
    roommateOpen: request.roommateOpen,
    requiredAmenities: request.requiredAmenities,
    preferredCommute: request.preferredCommute,
    description: request.description,
    publishedAt: date(request.publishedAt),
    expiresAt: date(request.expiresAt),
    createdAt: date(request.createdAt),
    updatedAt: date(request.updatedAt),
    version: owner ? request.version : undefined,
    city: request.city,
    university: request.university,
    requester: {
      id: request.user.id,
      username: request.user.username,
      name: `${request.user.firstName} ${request.user.lastName}`.trim(),
      avatarMediaId: request.user.avatarMediaId,
      official:
        request.user.officialProfileStatus === "APPROVED"
          ? {
              label:
                request.user.officialOrganizationName ??
                "Official Kondo account",
            }
          : null,
    },
    owner,
  };
}

async function validateRequestReferences(
  data: ReturnType<typeof housingRequestInputSchema.parse>,
) {
  const [city, university] = await Promise.all([
    prisma.city.findUnique({
      where: { id: data.cityId },
      select: { id: true, countryId: true },
    }),
    data.universityId
      ? prisma.university.findUnique({
          where: { id: data.universityId },
          select: { id: true, cityId: true },
        })
      : null,
  ]);
  if (!city) throw new HousingRequestError("Choose a valid city.");
  if (data.universityId && (!university || university.cityId !== city.id)) {
    throw new HousingRequestError(
      "The university must belong to the selected city.",
    );
  }
  if (data.expiresAt <= new Date()) {
    throw new HousingRequestError(
      "The request expiration date must be in the future.",
    );
  }
}

export async function createHousingRequest(input: {
  actorId: string;
  data: HousingRequestInput;
  meta?: RequestMeta;
}) {
  const data = housingRequestInputSchema.parse(input.data);
  await validateRequestReferences(data);
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.housingRequest.create({
      data: {
        userId: input.actorId,
        status: "DRAFT",
        visibility: data.visibility,
        cityId: data.cityId,
        preferredDistrict: data.preferredDistrict,
        universityId: data.universityId,
        moveInDate: data.moveInDate,
        stayDurationMonths: data.stayDurationMonths,
        minimumBudgetMinor: data.minimumBudgetMinor,
        maximumBudgetMinor: data.maximumBudgetMinor,
        currency: data.currency,
        preferredListingTypes: data.preferredListingTypes,
        roomPreference: data.roomPreference,
        roommateOpen: data.roommateOpen,
        requiredAmenities: data.requiredAmenities,
        preferredCommute: data.preferredCommute,
        description: data.description,
        contactPreference: data.contactPreference,
        expiresAt: data.expiresAt,
      },
      select: { id: true, status: true, version: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "HOUSING_REQUEST_CREATED",
      entityType: "HousingRequest",
      entityId: created.id,
      newValue: { cityId: data.cityId, visibility: data.visibility },
      ...input.meta,
    });
    return created;
  });
  revalidateHousing({});
  await captureServerProductEvent({
    distinctId: input.actorId,
    event: PRODUCT_EVENTS.HOUSING_REQUEST_CREATED,
    properties: { city_id: data.cityId },
  });
  return request;
}

async function requireOwnedRequest(userId: string, requestId: string) {
  const request = await prisma.housingRequest.findFirst({
    where: { id: requestId, userId },
    select: { id: true, status: true, version: true },
  });
  if (!request)
    throw new HousingRequestError("Housing request not found.", 404);
  return request;
}

export async function updateHousingRequest(input: {
  actorId: string;
  requestId: string;
  data: HousingRequestInput;
  expectedVersion?: number;
  meta?: RequestMeta;
}) {
  const current = await requireOwnedRequest(input.actorId, input.requestId);
  if (!["DRAFT", "PAUSED", "EXPIRED"].includes(current.status)) {
    throw new HousingRequestError("Pause this request before editing it.", 409);
  }
  const data = housingRequestInputSchema.parse(input.data);
  await validateRequestReferences(data);
  const count = await prisma.housingRequest.updateMany({
    where: {
      id: current.id,
      userId: input.actorId,
      version: input.expectedVersion ?? current.version,
    },
    data: {
      status: current.status === "EXPIRED" ? "DRAFT" : undefined,
      visibility: data.visibility,
      cityId: data.cityId,
      preferredDistrict: data.preferredDistrict,
      universityId: data.universityId,
      moveInDate: data.moveInDate,
      stayDurationMonths: data.stayDurationMonths,
      minimumBudgetMinor: data.minimumBudgetMinor,
      maximumBudgetMinor: data.maximumBudgetMinor,
      currency: data.currency,
      preferredListingTypes: data.preferredListingTypes,
      roomPreference: data.roomPreference,
      roommateOpen: data.roommateOpen,
      requiredAmenities: data.requiredAmenities,
      preferredCommute: data.preferredCommute,
      description: data.description,
      contactPreference: data.contactPreference,
      expiresAt: data.expiresAt,
      version: { increment: 1 },
    },
  });
  if (!count.count) {
    throw new HousingRequestError(
      "This request changed in another session. Refresh and try again.",
      409,
    );
  }
  await prisma.$transaction((tx) =>
    writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "HOUSING_REQUEST_UPDATED",
      entityType: "HousingRequest",
      entityId: current.id,
      ...input.meta,
    }),
  );
  revalidateHousing({});
  return { id: current.id };
}

const requestTransitions: Record<
  HousingRequestStatus,
  readonly HousingRequestStatus[]
> = {
  DRAFT: ["PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "MATCHED", "ARCHIVED"],
  PAUSED: ["PUBLISHED", "MATCHED", "ARCHIVED"],
  MATCHED: ["ARCHIVED"],
  EXPIRED: ["DRAFT", "ARCHIVED"],
  ARCHIVED: [],
  REMOVED: [],
};

export async function transitionHousingRequest(input: {
  actorId: string;
  requestId: string;
  to: HousingRequestStatus;
  expectedVersion?: number;
  meta?: RequestMeta;
}) {
  const request = await requireOwnedRequest(input.actorId, input.requestId);
  if (!requestTransitions[request.status].includes(input.to)) {
    throw new HousingRequestError(
      `Housing request cannot move from ${request.status} to ${input.to}.`,
      409,
    );
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.housingRequest.updateMany({
      where: {
        id: request.id,
        userId: input.actorId,
        status: request.status,
        version: input.expectedVersion ?? request.version,
        ...(input.to === "PUBLISHED" ? { expiresAt: { gt: now } } : {}),
      },
      data: {
        status: input.to,
        publishedAt: input.to === "PUBLISHED" ? now : undefined,
        pausedAt: input.to === "PAUSED" ? now : undefined,
        matchedAt: input.to === "MATCHED" ? now : undefined,
        archivedAt: input.to === "ARCHIVED" ? now : undefined,
        version: { increment: 1 },
      },
    });
    if (!count.count) {
      throw new HousingRequestError(
        "This request changed or has expired. Refresh and try again.",
        409,
      );
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: "HOUSING_REQUEST_STATUS_CHANGED",
      entityType: "HousingRequest",
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status: input.to },
      ...input.meta,
    });
    return { id: request.id, status: input.to };
  });
  revalidateHousing({});
  return updated;
}

export async function listHousingRequests(input: {
  viewerId?: string | null;
  cityId?: string;
  mine?: boolean;
  limit?: number;
}) {
  const limit = Math.min(30, Math.max(1, input.limit ?? 18));
  if (input.mine && !input.viewerId) {
    throw new HousingRequestError(
      "Sign in to view your Housing requests.",
      401,
    );
  }
  const now = new Date();
  const where: Prisma.HousingRequestWhereInput = input.mine
    ? { userId: input.viewerId! }
    : {
        status: "PUBLISHED",
        expiresAt: { gt: now },
        ...(input.cityId ? { cityId: input.cityId } : {}),
        visibility: input.viewerId
          ? { in: ["PUBLIC", "MEMBERS_ONLY"] }
          : "PUBLIC",
      };
  const rows = await prisma.housingRequest.findMany({
    where,
    select: requestSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map((row) => serializeHousingRequest(row, input.viewerId));
}

export async function getHousingRequest(input: {
  requestId: string;
  viewerId?: string | null;
}) {
  const request = await prisma.housingRequest.findUnique({
    where: { id: input.requestId },
    select: requestSelect,
  });
  if (
    !request ||
    (request.userId !== input.viewerId &&
      (request.status !== "PUBLISHED" ||
        request.expiresAt <= new Date() ||
        request.visibility === "MATCHING_ONLY" ||
        (request.visibility === "MEMBERS_ONLY" && !input.viewerId)))
  ) {
    throw new HousingRequestError("Housing request not found.", 404);
  }
  return serializeHousingRequest(request, input.viewerId);
}

export async function expireHousingRequests(now = new Date()) {
  const result = await prisma.housingRequest.updateMany({
    where: { status: { in: ["PUBLISHED", "PAUSED"] }, expiresAt: { lte: now } },
    data: { status: "EXPIRED", version: { increment: 1 } },
  });
  if (result.count) revalidateHousing({});
  return { expired: result.count };
}
