import type { Prisma, StudyLevel } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { validateOnboardingReferences } from "@/lib/reference-data";

type OnboardingReferences = {
  countryId: string;
  cityId: string;
  universityId: string;
};

export type OnboardingDraftInput = OnboardingReferences & {
  degree?: string;
  studyLevel?: StudyLevel;
  arrivalDate?: Date;
  languages?: string[];
  interests?: string[];
};

export type OnboardingInput = OnboardingReferences & {
  degree: string;
  studyLevel: StudyLevel;
  arrivalDate: Date;
  languages: string[];
  interests: string[];
};

type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

function draftData(input: OnboardingDraftInput): Prisma.UserUpdateInput {
  return {
    country: { connect: { id: input.countryId } },
    city: { connect: { id: input.cityId } },
    university: { connect: { id: input.universityId } },
    degree:
      input.degree === undefined ? undefined : input.degree.trim() || null,
    studyLevel: input.studyLevel,
    arrivalDate: input.arrivalDate,
    languages: input.languages ? { set: input.languages } : undefined,
    interests: input.interests ? { set: input.interests } : undefined,
  };
}

export async function saveOnboardingDraft(
  userId: string,
  input: OnboardingDraftInput,
) {
  return prisma.$transaction(async (tx) => {
    await validateOnboardingReferences(input, tx);
    const updated = await tx.user.update({
      where: { id: userId },
      data: draftData(input),
      select: {
        countryId: true,
        cityId: true,
        universityId: true,
        degree: true,
        studyLevel: true,
        arrivalDate: true,
        languages: true,
        interests: true,
        onboardingCompletedAt: true,
      },
    });
    return {
      ...updated,
      arrivalDate: updated.arrivalDate?.toISOString() ?? null,
      onboardingCompletedAt:
        updated.onboardingCompletedAt?.toISOString() ?? null,
    };
  });
}

export async function completeOnboarding(
  userId: string,
  input: OnboardingInput,
  metadata: RequestMetadata = {},
) {
  return prisma.$transaction(async (tx) => {
    await validateOnboardingReferences(input, tx);
    const previous = await tx.user.findUnique({
      where: { id: userId },
      select: {
        countryId: true,
        cityId: true,
        universityId: true,
        degree: true,
        studyLevel: true,
        arrivalDate: true,
        languages: true,
        interests: true,
        onboardingCompletedAt: true,
      },
    });
    if (!previous) throw new Error("Authenticated user no longer exists.");

    const completedAt = previous.onboardingCompletedAt ?? new Date();
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        ...draftData(input),
        onboardingCompletedAt: completedAt,
      },
      select: {
        countryId: true,
        cityId: true,
        universityId: true,
        degree: true,
        studyLevel: true,
        arrivalDate: true,
        languages: true,
        interests: true,
        onboardingCompletedAt: true,
      },
    });

    const oldValue = {
      countryId: previous.countryId,
      cityId: previous.cityId,
      universityId: previous.universityId,
      degree: previous.degree,
      studyLevel: previous.studyLevel,
      arrivalDate: previous.arrivalDate?.toISOString() ?? null,
      languages: previous.languages,
      interests: previous.interests,
    };
    const newValue = {
      countryId: updated.countryId,
      cityId: updated.cityId,
      universityId: updated.universityId,
      degree: updated.degree,
      studyLevel: updated.studyLevel,
      arrivalDate: updated.arrivalDate?.toISOString() ?? null,
      languages: updated.languages,
      interests: updated.interests,
    };

    await writeAuditLogWithClient(tx, {
      actorId: userId,
      action: previous.onboardingCompletedAt
        ? "ONBOARDING_UPDATED"
        : "ONBOARDING_COMPLETED",
      entityType: "User",
      entityId: userId,
      oldValue,
      newValue,
      ...metadata,
    });

    return {
      ...newValue,
      onboardingCompletedAt: completedAt.toISOString(),
    };
  });
}
