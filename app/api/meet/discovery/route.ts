import type { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import {
  MEET_PREMIUM_FEATURES,
  type MeetPremiumFeature,
} from "@/features/meet/config";
import { meetDiscoveryRequestSchema } from "@/features/meet/schemas";
import { isAfricanCountryCode } from "@/lib/african-countries";
import { logServerEvent } from "@/lib/logger";
import {
  getPremiumAccess,
  hasPremiumFeature,
  type PremiumAccess,
} from "@/lib/premium";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

function allowsGender(
  preference: "ALL" | "MALE" | "FEMALE",
  gender: "MALE" | "FEMALE" | null,
) {
  return preference === "ALL" || preference === gender;
}

function ageFromBirthYear(birthYear: number | null, now = new Date()) {
  return birthYear ? now.getUTCFullYear() - birthYear : null;
}

function intersectGenderPreferences(
  first: "ALL" | "MALE" | "FEMALE",
  second: "ALL" | "MALE" | "FEMALE",
) {
  if (first === "ALL") return second;
  if (second === "ALL" || first === second) return first;
  return null;
}

function requiresPremiumFeature(
  distanceRange: "KM_5" | "KM_10" | "KM_20" | "CITY" | "OTHER_CITY",
): MeetPremiumFeature | null {
  if (distanceRange === "OTHER_CITY") {
    return MEET_PREMIUM_FEATURES.OTHER_CITY;
  }
  return null;
}

function premiumRequired(access: PremiumAccess, feature: MeetPremiumFeature) {
  return !hasPremiumFeature(access, feature);
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = meetDiscoveryRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid filters.");
  }
  if (
    parsed.data.countryPreferenceCode &&
    !isAfricanCountryCode(parsed.data.countryPreferenceCode)
  ) {
    return jsonError("Select a valid African country.");
  }

  try {
    const [profile, access] = await Promise.all([
      prisma.meetDiscoveryProfile.findUnique({
        where: { userId: user.id },
      }),
      getPremiumAccess(user.id),
    ]);
    if (
      !profile?.completedAt ||
      !profile.discoveryCityId ||
      !profile.discoveryUniversityId
    ) {
      return Response.json(
        {
          error: "Complete your Meet Discovery Profile before exploring.",
          code: "MEET_PROFILE_REQUIRED",
        },
        { status: 428 },
      );
    }

    const premiumFeature = requiresPremiumFeature(parsed.data.distanceRange);
    if (premiumFeature && premiumRequired(access, premiumFeature)) {
      return Response.json(
        {
          error:
            parsed.data.distanceRange === "OTHER_CITY"
              ? "Searching in another city is available with Meet Premium."
              : "Extended-distance discovery is available with Meet Premium.",
          code: "MEET_PREMIUM_REQUIRED",
          feature: premiumFeature,
        },
        { status: 403 },
      );
    }

    if (parsed.data.mode === "NEARBY" && !profile.nearbyVisibility) {
      return jsonError(
        "Enable Nearby Visibility in Discovery Settings to continue.",
        422,
      );
    }
    if (parsed.data.mode === "LOOKING_FOR" && !parsed.data.intents.length) {
      return jsonError("Choose at least one reason for meeting.", 422);
    }

    const targetCityId =
      parsed.data.distanceRange === "OTHER_CITY"
        ? parsed.data.otherCityId
        : (profile.discoveryCityId ?? user.cityId);
    const targetUniversityId =
      profile.discoveryUniversityId ?? user.universityId;
    if (parsed.data.mode === "NEARBY" && !targetCityId) {
      return jsonError(
        parsed.data.distanceRange === "OTHER_CITY"
          ? "Choose another city before exploring."
          : "Add your study city before using nearby discovery.",
        422,
      );
    }

    const viewerAge = ageFromBirthYear(profile.birthYear);
    const candidateGender = intersectGenderPreferences(
      profile.interestedIn,
      parsed.data.genderPreference,
    );
    const currentYear = new Date().getUTCFullYear();
    const profileCompatibility: Prisma.MeetDiscoveryProfileWhereInput = {
      completedAt: { not: null },
      interestedIn: user.gender ? { in: ["ALL", user.gender] } : "ALL",
      ...(viewerAge === null
        ? {}
        : {
            minimumAge: { lte: viewerAge },
            maximumAge: { gte: viewerAge },
          }),
      OR: [
        { birthYear: null },
        {
          birthYear: {
            gte: currentYear - profile.maximumAge,
            lte: currentYear - profile.minimumAge,
          },
        },
      ],
    };

    const candidates = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        profileAudience: { in: ["PUBLIC", "MEMBERS"] },
        gender:
          candidateGender === "ALL"
            ? { not: null }
            : (candidateGender ?? { in: [] }),
        ...(parsed.data.countryPreferenceCode
          ? { country: { code: parsed.data.countryPreferenceCode } }
          : {}),
        ...(parsed.data.mode === "NEARBY"
          ? {
              AND: [
                {
                  meetDiscoveryProfile: {
                    is: {
                      ...profileCompatibility,
                      nearbyVisibility: true,
                    },
                  },
                },
                {
                  OR: [
                    {
                      meetDiscoveryProfile: {
                        is: { discoveryCityId: targetCityId },
                      },
                    },
                    {
                      cityId: targetCityId,
                      meetDiscoveryProfile: {
                        is: { discoveryCityId: null },
                      },
                    },
                  ],
                },
                ...(["KM_5", "KM_10"].includes(parsed.data.distanceRange) &&
                targetUniversityId
                  ? [
                      {
                        OR: [
                          {
                            meetDiscoveryProfile: {
                              is: {
                                discoveryUniversityId: targetUniversityId,
                              },
                            },
                          },
                          {
                            universityId: targetUniversityId,
                            meetDiscoveryProfile: {
                              is: { discoveryUniversityId: null },
                            },
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            }
          : {
              meetDiscoveryProfile: {
                is: {
                  ...profileCompatibility,
                  lookingFor: { hasSome: parsed.data.intents },
                },
              },
            }),
        blockedUsers: { none: { blockedId: user.id } },
        blockedByUsers: { none: { blockerId: user.id } },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        gender: true,
        cityId: true,
        universityId: true,
        avatarMediaId: true,
        bio: true,
        lastActiveAt: true,
        languages: true,
        interests: true,
        locationAudience: true,
        educationAudience: true,
        languagesAudience: true,
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
        country: { select: { name: true, emoji: true } },
        city: { select: { name: true } },
        university: { select: { id: true, name: true, shortName: true } },
        meetDiscoveryProfile: {
          include: {
            discoveryCity: { select: { name: true } },
            discoveryUniversity: {
              select: { id: true, name: true, shortName: true },
            },
          },
        },
      },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
      take: access.active ? 60 : 30,
    });

    const profiles = candidates
      .filter((candidate) => {
        const discovery = candidate.meetDiscoveryProfile;
        if (!discovery || !candidate.gender) return false;
        if (!allowsGender(profile.interestedIn, candidate.gender)) return false;
        if (!allowsGender(discovery.interestedIn, user.gender)) return false;

        const candidateAge = ageFromBirthYear(discovery.birthYear);
        if (
          candidateAge !== null &&
          (candidateAge < profile.minimumAge ||
            candidateAge > profile.maximumAge)
        ) {
          return false;
        }
        if (
          viewerAge !== null &&
          (viewerAge < discovery.minimumAge || viewerAge > discovery.maximumAge)
        ) {
          return false;
        }

        const candidateCityId = discovery.discoveryCityId ?? candidate.cityId;
        const candidateUniversityId =
          discovery.discoveryUniversityId ?? candidate.universityId;
        if (parsed.data.mode === "NEARBY" && candidateCityId !== targetCityId) {
          return false;
        }
        if (
          parsed.data.mode === "NEARBY" &&
          ["KM_5", "KM_10"].includes(parsed.data.distanceRange) &&
          targetUniversityId &&
          candidateUniversityId !== targetUniversityId
        ) {
          return false;
        }

        if (
          parsed.data.mode === "LOOKING_FOR" &&
          !parsed.data.intents.some((intent) =>
            discovery.lookingFor.includes(intent),
          )
        ) {
          return false;
        }
        return true;
      })
      .slice(0, access.active ? 24 : 12)
      .map((candidate) => {
        const discovery = candidate.meetDiscoveryProfile!;
        const canShowLocation =
          discovery.nearbyVisibility &&
          candidate.locationAudience !== "PRIVATE";
        const canShowUniversity =
          discovery.showUniversity && candidate.educationAudience !== "PRIVATE";
        const canShowLanguages =
          discovery.showLanguages && candidate.languagesAudience !== "PRIVATE";
        const university =
          discovery.discoveryUniversity?.shortName ??
          discovery.discoveryUniversity?.name ??
          candidate.university?.shortName ??
          candidate.university?.name ??
          null;
        const city =
          discovery.discoveryCity?.name ?? candidate.city?.name ?? null;
        const distanceLabel =
          parsed.data.mode !== "NEARBY"
            ? null
            : parsed.data.distanceRange === "KM_5" && university
              ? `Near ${university}`
              : parsed.data.distanceRange === "KM_10" && university
                ? `Around the ${university} study area`
                : parsed.data.distanceRange === "KM_20"
                  ? `Within the ${city ?? "selected city"} student area`
                  : parsed.data.distanceRange === "OTHER_CITY"
                    ? `Around ${city ?? "the selected city"}`
                    : `Around ${city ?? "your study city"}`;

        return {
          id: candidate.id,
          username: candidate.username,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          avatarMediaId: candidate.avatarMediaId,
          bio: candidate.bio,
          age: discovery.showAge ? ageFromBirthYear(discovery.birthYear) : null,
          lastActiveAt: candidate.lastActiveAt?.toISOString() ?? null,
          distanceLabel,
          location: canShowLocation
            ? {
                city: parsed.data.mode === "NEARBY" ? "Approximate area" : city,
                countryName: discovery.showNationality
                  ? (candidate.country?.name ?? null)
                  : null,
                countryEmoji: discovery.showNationality
                  ? (candidate.country?.emoji ?? null)
                  : null,
              }
            : null,
          university: canShowUniversity ? university : null,
          languages: canShowLanguages ? candidate.languages.slice(0, 4) : [],
          lookingFor: discovery.showInterests
            ? discovery.lookingFor.slice(0, 4)
            : [],
          official:
            candidate.officialProfileStatus === "APPROVED"
              ? {
                  organizationType: candidate.officialOrganizationType,
                  organizationName: candidate.officialOrganizationName,
                  verifiedAt:
                    candidate.officialVerifiedAt?.toISOString() ?? null,
                }
              : null,
        };
      });

    logServerEvent("meet.discovery.completed", {
      userId: user.id,
      mode: parsed.data.mode,
      distanceRange: parsed.data.distanceRange,
      candidateCount: candidates.length,
      resultCount: profiles.length,
      premium: access.active,
      targetCityId,
      targetUniversityId,
    });

    return Response.json(
      {
        mode: parsed.data.mode,
        privacy: "APPROXIMATE_ONLY",
        profiles,
        premium: access,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("meet.discovery", error);
  }
}
