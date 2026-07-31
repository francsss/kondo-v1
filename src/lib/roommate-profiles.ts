import type { Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  roommateDiscoverySchema,
  roommateProfileInputSchema,
} from "@/features/housing/schemas";
import { revalidateHousing } from "@/lib/housing-cache";
import { prisma } from "@/lib/prisma";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };
type ProfileInput = Parameters<typeof roommateProfileInputSchema.parse>[0];

export class RoommateProfileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "RoommateProfileError";
  }
}

const profileSelect = {
  id: true,
  userId: true,
  status: true,
  visibility: true,
  moveInDate: true,
  stayDurationMonths: true,
  budgetMinimumMinor: true,
  budgetMaximumMinor: true,
  currency: true,
  preferredHousingTypes: true,
  currentHousingSituation: true,
  languages: true,
  sleepSchedule: true,
  routine: true,
  cleanlinessPreference: true,
  cookingFrequency: true,
  smokingPreference: true,
  petPreference: true,
  guestPreference: true,
  noisePreference: true,
  genderPreference: true,
  introduction: true,
  allowInterests: true,
  showUniversity: true,
  showApproximateLocation: true,
  activatedAt: true,
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
      gender: true,
      status: true,
      officialProfileStatus: true,
      officialOrganizationName: true,
    },
  },
} satisfies Prisma.RoommateProfileSelect;

type ProfileRecord = Prisma.RoommateProfileGetPayload<{
  select: typeof profileSelect;
}>;

function overlap(first: string[], second: string[]) {
  const set = new Set(first.map((value) => value.toLowerCase()));
  return second.filter((value) => set.has(value.toLowerCase()));
}

export function roommateBudgetsOverlap(
  first: { minimum: number | null; maximum: number },
  second: { minimum: number | null; maximum: number },
) {
  return (
    first.maximum >= (second.minimum ?? 0) &&
    second.maximum >= (first.minimum ?? 0)
  );
}

function compatibilityReasons(
  viewer: ProfileRecord | null,
  candidate: ProfileRecord,
) {
  if (!viewer) return [`Looking in ${candidate.city.name}`];
  const reasons: string[] = [];
  if (viewer.city.id === candidate.city.id) reasons.push("Same city");
  if (
    viewer.university?.id &&
    viewer.university.id === candidate.university?.id
  ) {
    reasons.push("Same university");
  }
  const sharedLanguages = overlap(viewer.languages, candidate.languages);
  if (sharedLanguages.length)
    reasons.push(`Shared language: ${sharedLanguages[0]}`);
  if (
    viewer.currency === candidate.currency &&
    roommateBudgetsOverlap(
      {
        minimum: viewer.budgetMinimumMinor,
        maximum: viewer.budgetMaximumMinor,
      },
      {
        minimum: candidate.budgetMinimumMinor,
        maximum: candidate.budgetMaximumMinor,
      },
    )
  ) {
    reasons.push("Overlapping budget");
  }
  const days =
    Math.abs(viewer.moveInDate.getTime() - candidate.moveInDate.getTime()) /
    86_400_000;
  if (days <= 30) reasons.push("Similar move-in timing");
  if (
    viewer.cleanlinessPreference &&
    viewer.cleanlinessPreference === candidate.cleanlinessPreference
  ) {
    reasons.push("Similar cleanliness preference");
  }
  if (viewer.smokingPreference === candidate.smokingPreference) {
    reasons.push("Compatible smoking preference");
  }
  return reasons.slice(0, 4);
}

export function serializeRoommateProfile(
  profile: ProfileRecord,
  viewerId: string,
  viewerProfile: ProfileRecord | null,
) {
  const owner = profile.userId === viewerId;
  return {
    id: profile.id,
    userId: profile.userId,
    status: profile.status,
    moveInDate: profile.moveInDate.toISOString(),
    stayDurationMonths: profile.stayDurationMonths,
    budgetMinimumMinor: profile.budgetMinimumMinor,
    budgetMaximumMinor: profile.budgetMaximumMinor,
    currency: profile.currency,
    preferredHousingTypes: profile.preferredHousingTypes,
    currentHousingSituation: profile.currentHousingSituation,
    languages: profile.languages,
    sleepSchedule: profile.sleepSchedule,
    routine: profile.routine,
    cleanlinessPreference: profile.cleanlinessPreference,
    cookingFrequency: profile.cookingFrequency,
    smokingPreference: profile.smokingPreference,
    petPreference: profile.petPreference,
    guestPreference: profile.guestPreference,
    noisePreference: profile.noisePreference,
    introduction: profile.introduction,
    allowInterests: profile.allowInterests,
    city: profile.showApproximateLocation || owner ? profile.city : null,
    university: profile.showUniversity || owner ? profile.university : null,
    person: {
      username: profile.user.username,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      name: `${profile.user.firstName} ${profile.user.lastName}`.trim(),
      avatarMediaId: profile.user.avatarMediaId,
      official:
        profile.user.officialProfileStatus === "APPROVED"
          ? {
              label:
                profile.user.officialOrganizationName ??
                "Official Kondo account",
            }
          : null,
    },
    matchReasons: owner ? [] : compatibilityReasons(viewerProfile, profile),
    owner,
    visibility: owner ? profile.visibility : undefined,
    version: owner ? profile.version : undefined,
    expiresAt: owner ? (profile.expiresAt?.toISOString() ?? null) : undefined,
  };
}

async function validateProfileReferences(
  data: ReturnType<typeof roommateProfileInputSchema.parse>,
) {
  const [city, university] = await Promise.all([
    prisma.city.findUnique({
      where: { id: data.cityId },
      select: { id: true },
    }),
    data.universityId
      ? prisma.university.findUnique({
          where: { id: data.universityId },
          select: { id: true, cityId: true },
        })
      : null,
  ]);
  if (!city) throw new RoommateProfileError("Choose a valid city.");
  if (data.universityId && (!university || university.cityId !== city.id)) {
    throw new RoommateProfileError(
      "The university must belong to the selected city.",
    );
  }
}

export async function upsertRoommateProfile(input: {
  actorId: string;
  data: ProfileInput;
  expectedVersion?: number;
  meta?: RequestMeta;
}) {
  const data = roommateProfileInputSchema.parse(input.data);
  await validateProfileReferences(data);
  const existing = await prisma.roommateProfile.findUnique({
    where: { userId: input.actorId },
    select: { id: true, version: true },
  });
  if (
    existing &&
    input.expectedVersion != null &&
    existing.version !== input.expectedVersion
  ) {
    throw new RoommateProfileError(
      "This profile changed in another session. Refresh and try again.",
      409,
    );
  }
  const now = new Date();
  const profile = await prisma.$transaction(async (tx) => {
    const saved = await tx.roommateProfile.upsert({
      where: { userId: input.actorId },
      create: {
        userId: input.actorId,
        status: data.active ? "ACTIVE" : "INACTIVE",
        visibility: data.visibility,
        cityId: data.cityId,
        universityId: data.universityId,
        moveInDate: data.moveInDate,
        stayDurationMonths: data.stayDurationMonths,
        budgetMinimumMinor: data.budgetMinimumMinor,
        budgetMaximumMinor: data.budgetMaximumMinor,
        currency: data.currency,
        preferredHousingTypes: data.preferredHousingTypes,
        currentHousingSituation: data.currentHousingSituation,
        languages: data.languages,
        sleepSchedule: data.sleepSchedule,
        routine: data.routine,
        cleanlinessPreference: data.cleanlinessPreference,
        cookingFrequency: data.cookingFrequency,
        smokingPreference: data.smokingPreference,
        petPreference: data.petPreference,
        guestPreference: data.guestPreference,
        noisePreference: data.noisePreference,
        genderPreference: data.genderPreference,
        introduction: data.introduction,
        allowInterests: data.allowInterests,
        showUniversity: data.showUniversity,
        showApproximateLocation: data.showApproximateLocation,
        activatedAt: data.active ? now : null,
        expiresAt: data.active
          ? new Date(now.getTime() + 90 * 24 * 60 * 60_000)
          : null,
      },
      update: {
        status: data.active ? "ACTIVE" : "INACTIVE",
        visibility: data.visibility,
        cityId: data.cityId,
        universityId: data.universityId,
        moveInDate: data.moveInDate,
        stayDurationMonths: data.stayDurationMonths,
        budgetMinimumMinor: data.budgetMinimumMinor,
        budgetMaximumMinor: data.budgetMaximumMinor,
        currency: data.currency,
        preferredHousingTypes: data.preferredHousingTypes,
        currentHousingSituation: data.currentHousingSituation,
        languages: data.languages,
        sleepSchedule: data.sleepSchedule,
        routine: data.routine,
        cleanlinessPreference: data.cleanlinessPreference,
        cookingFrequency: data.cookingFrequency,
        smokingPreference: data.smokingPreference,
        petPreference: data.petPreference,
        guestPreference: data.guestPreference,
        noisePreference: data.noisePreference,
        genderPreference: data.genderPreference,
        introduction: data.introduction,
        allowInterests: data.allowInterests,
        showUniversity: data.showUniversity,
        showApproximateLocation: data.showApproximateLocation,
        activatedAt: data.active ? now : undefined,
        expiresAt: data.active
          ? new Date(now.getTime() + 90 * 24 * 60 * 60_000)
          : null,
        version: { increment: 1 },
      },
      select: { id: true, status: true, version: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actorId,
      action: existing
        ? "ROOMMATE_PROFILE_UPDATED"
        : "ROOMMATE_PROFILE_CREATED",
      entityType: "RoommateProfile",
      entityId: saved.id,
      ...input.meta,
    });
    return saved;
  });
  revalidateHousing({});
  await captureServerProductEvent({
    distinctId: input.actorId,
    event: PRODUCT_EVENTS.ROOMMATE_PROFILE_CREATED,
    properties: { active: data.active, updated: Boolean(existing) },
  });
  return profile;
}

async function viewerProfile(userId: string) {
  return prisma.roommateProfile.findUnique({
    where: { userId },
    select: profileSelect,
  });
}

export async function discoverRoommateProfiles(input: {
  viewerId: string;
  query: Parameters<typeof roommateDiscoverySchema.parse>[0];
}) {
  const query = roommateDiscoverySchema.parse(input.query);
  const current = await viewerProfile(input.viewerId);
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [{ blockerId: input.viewerId }, { blockedId: input.viewerId }],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = blocks.map((block) =>
    block.blockerId === input.viewerId ? block.blockedId : block.blockerId,
  );
  const where: Prisma.RoommateProfileWhereInput = {
    userId: { notIn: [input.viewerId, ...blockedIds] },
    status: "ACTIVE",
    visibility: "MEMBERS_ONLY",
    allowInterests: true,
    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    user: { status: "ACTIVE" },
    ...(query.cityId ? { cityId: query.cityId } : {}),
    ...(query.universityId ? { universityId: query.universityId } : {}),
    ...(query.moveInFrom || query.moveInTo
      ? {
          moveInDate: {
            ...(query.moveInFrom ? { gte: query.moveInFrom } : {}),
            ...(query.moveInTo ? { lte: query.moveInTo } : {}),
          },
        }
      : {}),
    ...(query.maximumBudgetMinor
      ? { budgetMinimumMinor: { lte: query.maximumBudgetMinor } }
      : {}),
    ...(query.languages.length
      ? { languages: { hasSome: query.languages } }
      : {}),
    ...(query.smokingPreference
      ? { smokingPreference: query.smokingPreference }
      : {}),
    ...(query.petPreference ? { petPreference: query.petPreference } : {}),
  };
  const rows = await prisma.roommateProfile.findMany({
    where,
    select: profileSelect,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: query.limit,
  });
  return rows
    .map((row) => serializeRoommateProfile(row, input.viewerId, current))
    .sort(
      (first, second) =>
        second.matchReasons.length - first.matchReasons.length ||
        first.id.localeCompare(second.id),
    );
}

export async function getRoommateProfile(input: {
  viewerId: string;
  profileId: string;
}) {
  const profile = await prisma.roommateProfile.findUnique({
    where: { id: input.profileId },
    select: profileSelect,
  });
  if (!profile)
    throw new RoommateProfileError("Roommate profile not found.", 404);
  const owner = profile.userId === input.viewerId;
  const blocked = owner
    ? false
    : Boolean(
        await prisma.userBlock.findFirst({
          where: {
            OR: [
              { blockerId: input.viewerId, blockedId: profile.userId },
              { blockerId: profile.userId, blockedId: input.viewerId },
            ],
          },
          select: { blockerId: true },
        }),
      );
  if (
    !owner &&
    (blocked ||
      profile.status !== "ACTIVE" ||
      profile.visibility !== "MEMBERS_ONLY" ||
      !profile.allowInterests ||
      (profile.expiresAt && profile.expiresAt <= new Date()))
  ) {
    throw new RoommateProfileError("Roommate profile not found.", 404);
  }
  const current = owner ? profile : await viewerProfile(input.viewerId);
  return serializeRoommateProfile(profile, input.viewerId, current);
}
