import type { Prisma, StudentJourney, StudyLevel } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { validateOnboardingReferences } from "@/lib/reference-data";

type OnboardingReferences = {
  countryId: string;
  cityId: string;
  universityId: string;
};

// A draft is saved after every onboarding step, so any reference the member
// has not reached yet is legitimately absent — only completeOnboarding
// requires the full triplet.
type PartialOnboardingReferences = {
  countryId?: string;
  cityId?: string;
  universityId?: string;
};

export type OnboardingDraftInput = PartialOnboardingReferences & {
  studentJourney?: StudentJourney;
  degree?: string;
  studyLevel?: StudyLevel;
  arrivalDate?: Date;
  languages?: string[];
  interests?: string[];
};

export type OnboardingInput = OnboardingReferences & {
  studentJourney: StudentJourney;
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

function draftData(
  input: OnboardingDraftInput,
  options: { clearUniversity?: boolean } = {},
): Prisma.UserUncheckedUpdateInput {
  // Prisma's relation-nested UserUpdateInput (`city: { connect }`) and its
  // scalar UserUncheckedUpdateInput (`cityId: ...`) can't be mixed in one
  // call — combining them makes Prisma validate against the relation-nested
  // shape and silently reject/drop the scalar field. Using plain scalar IDs
  // throughout keeps countryId/cityId/universityId in the same UPDATE
  // statement, which the DB consistency trigger requires when a city change
  // must also clear a now-mismatched university.
  return {
    studentJourney: input.studentJourney,
    countryId: input.countryId === undefined ? undefined : input.countryId,
    cityId: input.cityId === undefined ? undefined : input.cityId,
    universityId: options.clearUniversity
      ? null
      : input.universityId === undefined
        ? undefined
        : input.universityId,
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

    // A city change must never leave a stale university from a different
    // city attached. The client always resends both together when the
    // member actually picks a new university, so a cityId-only draft here
    // means their previous university (if any) needs to be cleared, not
    // silently left pointing at the old city.
    let clearUniversity = false;
    if (input.cityId !== undefined && input.universityId === undefined) {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { university: { select: { cityId: true } } },
      });
      if (current?.university && current.university.cityId !== input.cityId) {
        clearUniversity = true;
      }
    }

    const updated = await tx.user.update({
      where: { id: userId },
      data: draftData(input, { clearUniversity }),
      select: {
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
      },
    });

    const oldValue = {
      studentJourney: previous.studentJourney,
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
      studentJourney: updated.studentJourney,
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
