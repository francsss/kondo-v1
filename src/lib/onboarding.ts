import type {
  Prisma,
  ProspectiveApplicationStage,
  StudentJourney,
  StudyLevel,
  UniversityPreferenceMode,
  UserGender,
  KondoJourneyGroup,
  KondoJourneyStage,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { ensurePersonalNationalCommunityWithClient } from "@/lib/registration";
import {
  ReferenceDataError,
  validateOnboardingReferences,
} from "@/lib/reference-data";

type PersonalOnboardingFields = {
  gender?: UserGender;
  studentJourney?: StudentJourney;
  countryId?: string;
  cityId?: string;
  universityId?: string;
  degree?: string;
  studyLevel?: StudyLevel;
  arrivalDate?: Date;
  languages?: string[];
  interests?: string[];
  applicationStage?: ProspectiveApplicationStage;
  journeyGroup?: KondoJourneyGroup;
  journeyStage?: KondoJourneyStage;
  universityPreferenceMode?: UniversityPreferenceMode;
  targetCityIds?: string[];
  targetUniversityIds?: string[];
  expectedIntake?: Date;
  campusName?: string;
  graduationYear?: number;
  professionalArea?: string;
  currentCityName?: string;
  chinaRelationship?: string;
  currentProfessionalContext?: string;
  arrivalPreparationContext?: string;
  onboardingStep?: number;
};

export type OnboardingDraftInput = PersonalOnboardingFields;

export type OnboardingInput = PersonalOnboardingFields & {
  gender: UserGender;
  studentJourney: StudentJourney;
  languages: string[];
  interests: string[];
};

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function cleaned(value: string | undefined) {
  return value === undefined ? undefined : value.trim() || null;
}

function userDraftData(
  input: PersonalOnboardingFields,
  options: { clearUniversity?: boolean; clearStudyAffiliation?: boolean } = {},
): Prisma.UserUncheckedUpdateInput {
  return {
    gender: input.gender,
    studentJourney: input.studentJourney,
    countryId: input.countryId === undefined ? undefined : input.countryId,
    cityId: options.clearStudyAffiliation
      ? null
      : input.cityId === undefined
        ? undefined
        : input.cityId || null,
    universityId:
      options.clearUniversity || options.clearStudyAffiliation
        ? null
        : input.universityId === undefined
          ? undefined
          : input.universityId || null,
    degree: cleaned(input.degree),
    studyLevel: input.studyLevel,
    arrivalDate: input.arrivalDate,
    languages: input.languages ? { set: input.languages } : undefined,
    interests: input.interests ? { set: input.interests } : undefined,
  };
}

function journeyDetailData(input: PersonalOnboardingFields) {
  return {
    journeyGroup: input.journeyGroup,
    journeyStage: input.journeyStage,
    journeyUpdatedAt:
      input.journeyGroup !== undefined || input.journeyStage !== undefined
        ? new Date()
        : undefined,
    applicationStage: input.applicationStage,
    universityPreferenceMode: input.universityPreferenceMode,
    expectedIntake: input.expectedIntake,
    campusName: cleaned(input.campusName),
    graduationYear: input.graduationYear,
    professionalArea: cleaned(input.professionalArea),
    currentCityName: cleaned(input.currentCityName),
    chinaRelationship: cleaned(input.chinaRelationship),
    currentProfessionalContext: cleaned(input.currentProfessionalContext),
    arrivalPreparationContext: cleaned(input.arrivalPreparationContext),
    onboardingStep: input.onboardingStep,
  };
}

async function validateTargets(
  tx: Prisma.TransactionClient,
  input: {
    targetCityIds?: string[];
    targetUniversityIds?: string[];
  },
) {
  if (input.targetCityIds) {
    const uniqueCityIds = [...new Set(input.targetCityIds)];
    if (uniqueCityIds.length !== input.targetCityIds.length) {
      throw new ReferenceDataError(
        "Preferred cities must not contain duplicates.",
      );
    }
    const cityCount = await tx.city.count({
      where: {
        id: { in: uniqueCityIds },
        isActive: true,
        country: { code: "CN", isActive: true },
      },
    });
    if (cityCount !== uniqueCityIds.length) {
      throw new ReferenceDataError(
        "One or more preferred cities are unavailable.",
      );
    }
  }
  if (input.targetUniversityIds) {
    const uniqueUniversityIds = [...new Set(input.targetUniversityIds)];
    if (uniqueUniversityIds.length !== input.targetUniversityIds.length) {
      throw new ReferenceDataError(
        "Preferred universities must not contain duplicates.",
      );
    }
    const universityCount = await tx.university.count({
      where: {
        id: { in: uniqueUniversityIds },
        isActive: true,
        verified: true,
        country: { code: "CN", isActive: true },
      },
    });
    if (universityCount !== uniqueUniversityIds.length) {
      throw new ReferenceDataError(
        "One or more preferred universities are unavailable.",
      );
    }
  }
}

async function replaceTargets(
  tx: Prisma.TransactionClient,
  userId: string,
  input: {
    targetCityIds?: string[];
    targetUniversityIds?: string[];
  },
) {
  if (input.targetCityIds) {
    await tx.userTargetCity.deleteMany({ where: { userId } });
    if (input.targetCityIds.length) {
      await tx.userTargetCity.createMany({
        data: input.targetCityIds.map((cityId, displayOrder) => ({
          userId,
          cityId,
          displayOrder,
        })),
      });
    }
  }
  if (input.targetUniversityIds) {
    await tx.userTargetUniversity.deleteMany({ where: { userId } });
    if (input.targetUniversityIds.length) {
      await tx.userTargetUniversity.createMany({
        data: input.targetUniversityIds.map((universityId, displayOrder) => ({
          userId,
          universityId,
          displayOrder,
        })),
      });
    }
  }
}

const onboardingSelect = {
  gender: true,
  studentJourney: true,
  countryId: true,
  cityId: true,
  universityId: true,
  degree: true,
  studyLevel: true,
  arrivalDate: true,
  languages: true,
  interests: true,
  onboardingCompletedAt: true,
  journeyDetail: true,
  targetCities: {
    orderBy: { displayOrder: "asc" as const },
    select: { cityId: true },
  },
  targetUniversities: {
    orderBy: { displayOrder: "asc" as const },
    select: { universityId: true },
  },
} satisfies Prisma.UserSelect;

function onboardingDto(
  user: Prisma.UserGetPayload<{ select: typeof onboardingSelect }>,
) {
  return {
    gender: user.gender,
    studentJourney: user.studentJourney,
    countryId: user.countryId,
    cityId: user.cityId,
    universityId: user.universityId,
    degree: user.degree,
    studyLevel: user.studyLevel,
    arrivalDate: user.arrivalDate?.toISOString() ?? null,
    languages: user.languages,
    interests: user.interests,
    applicationStage: user.journeyDetail?.applicationStage ?? null,
    journeyGroup: user.journeyDetail?.journeyGroup ?? null,
    journeyStage: user.journeyDetail?.journeyStage ?? null,
    universityPreferenceMode:
      user.journeyDetail?.universityPreferenceMode ?? null,
    expectedIntake: user.journeyDetail?.expectedIntake?.toISOString() ?? null,
    campusName: user.journeyDetail?.campusName ?? null,
    graduationYear: user.journeyDetail?.graduationYear ?? null,
    professionalArea: user.journeyDetail?.professionalArea ?? null,
    currentCityName: user.journeyDetail?.currentCityName ?? null,
    chinaRelationship: user.journeyDetail?.chinaRelationship ?? null,
    currentProfessionalContext:
      user.journeyDetail?.currentProfessionalContext ?? null,
    arrivalPreparationContext:
      user.journeyDetail?.arrivalPreparationContext ?? null,
    onboardingStep: user.journeyDetail?.onboardingStep ?? 0,
    targetCityIds: user.targetCities.map(({ cityId }) => cityId),
    targetUniversityIds: user.targetUniversities.map(
      ({ universityId }) => universityId,
    ),
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}

export async function saveOnboardingDraft(
  userId: string,
  input: OnboardingDraftInput,
) {
  return prisma.$transaction(async (tx) => {
    await validateOnboardingReferences(input, tx);
    await validateTargets(tx, input);
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: {
        university: { select: { cityId: true } },
      },
    });
    if (!current) throw new Error("Authenticated user no longer exists.");

    const clearUniversity = Boolean(
      input.cityId !== undefined &&
      input.universityId === undefined &&
      current.university &&
      current.university.cityId !== input.cityId,
    );
    const clearStudyAffiliation =
      input.studentJourney === "PROFESSIONAL" ||
      input.studentJourney === "PROSPECTIVE_STUDENT";

    await tx.user.update({
      where: { id: userId },
      data: userDraftData(input, {
        clearUniversity,
        clearStudyAffiliation,
      }),
    });
    await tx.userJourneyDetail.upsert({
      where: { userId },
      create: {
        userId,
        ...journeyDetailData(input),
      },
      update: journeyDetailData(input),
    });
    await replaceTargets(tx, userId, input);
    const updated = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: onboardingSelect,
    });
    return onboardingDto(updated);
  });
}

export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  metadata: RequestMetadata = {},
) {
  const result = await prisma.$transaction(async (tx) => {
    await validateOnboardingReferences(input, tx);
    await validateTargets(tx, input);
    const previous = await tx.user.findUnique({
      where: { id: userId },
      select: onboardingSelect,
    });
    if (!previous) throw new Error("Authenticated user no longer exists.");

    const completedAt = previous.onboardingCompletedAt ?? new Date();
    const clearStudyAffiliation =
      input.studentJourney === "PROFESSIONAL" ||
      input.studentJourney === "PROSPECTIVE_STUDENT";

    await tx.user.update({
      where: { id: userId },
      data: {
        ...userDraftData(input, { clearStudyAffiliation }),
        onboardingCompletedAt: completedAt,
      },
    });
    await tx.userJourneyDetail.upsert({
      where: { userId },
      create: {
        userId,
        ...journeyDetailData({ ...input, onboardingStep: 5 }),
      },
      update: journeyDetailData({ ...input, onboardingStep: 5 }),
    });
    await replaceTargets(tx, userId, input);
    if (input.countryId) {
      await ensurePersonalNationalCommunityWithClient(tx, {
        userId,
        countryId: input.countryId,
      });
    }

    const updated = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: onboardingSelect,
    });
    await writeAuditLogWithClient(tx, {
      actorId: userId,
      action: previous.onboardingCompletedAt
        ? "ONBOARDING_UPDATED"
        : "ONBOARDING_COMPLETED",
      entityType: "User",
      entityId: userId,
      oldValue: {
        studentJourney: previous.studentJourney,
        countryId: previous.countryId,
        cityId: previous.cityId,
        universityId: previous.universityId,
      },
      newValue: {
        studentJourney: updated.studentJourney,
        countryId: updated.countryId,
        cityId: updated.cityId,
        universityId: updated.universityId,
        targetCityCount: updated.targetCities.length,
        targetUniversityCount: updated.targetUniversities.length,
      },
      ...metadata,
    });
    if (previous.studentJourney !== updated.studentJourney) {
      await writeAuditLogWithClient(tx, {
        actorId: userId,
        action: "PERSONAL_JOURNEY_CHANGED",
        entityType: "User",
        entityId: userId,
        oldValue: { studentJourney: previous.studentJourney },
        newValue: { studentJourney: updated.studentJourney },
        ...metadata,
      });
    }
    if (previous.universityId !== updated.universityId) {
      await writeAuditLogWithClient(tx, {
        actorId: userId,
        action: "CURRENT_UNIVERSITY_CHANGED",
        entityType: "User",
        entityId: userId,
        oldValue: { universityId: previous.universityId },
        newValue: { universityId: updated.universityId },
        ...metadata,
      });
    }
    return onboardingDto(updated);
  });
  await captureServerProductEvent({
    distinctId: userId,
    event: PRODUCT_EVENTS.ONBOARDING_COMPLETED,
    properties: { journey: result.studentJourney },
  });
  return result;
}
