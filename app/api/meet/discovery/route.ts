import { NextRequest } from "next/server";
import { z } from "zod";
import { isAfricanCountryCode } from "@/lib/african-countries";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const intentSchema = z.enum([
  "FRIENDS",
  "STUDY",
  "LANGUAGE",
  "SPORTS",
  "CITY",
  "NETWORKING",
  "COUNTRY",
  "RELATIONSHIP",
]);

const discoverySchema = z.object({
  mode: z.enum(["NEARBY", "LOOKING_FOR"]),
  genderPreference: z.enum(["ALL", "MALE", "FEMALE"]).default("ALL"),
  countryPreferenceCode: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => value === "" || isAfricanCountryCode(value),
      "Select a valid African country.",
    )
    .default(""),
  intents: z.array(intentSchema).max(8).default([]),
  nearbyEnabled: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = discoverySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid filters.");
  }

  const { mode, genderPreference, countryPreferenceCode, intents } =
    parsed.data;
  if (mode === "NEARBY" && !parsed.data.nearbyEnabled) {
    return jsonError("Enable approximate nearby discovery to continue.", 422);
  }
  if (mode === "NEARBY" && !user.cityId) {
    return jsonError("Add your study city before using nearby discovery.", 422);
  }
  if (mode === "LOOKING_FOR" && !intents.length) {
    return jsonError("Choose at least one reason for meeting.", 422);
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(mode === "NEARBY"
          ? { nearbyDiscoveryEnabled: true }
          : { meetIntents: { set: intents } }),
      },
    });

    const candidates = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        status: "ACTIVE",
        onboardingCompletedAt: { not: null },
        profileAudience: { in: ["PUBLIC", "MEMBERS"] },
        ...(genderPreference === "ALL" ? {} : { gender: genderPreference }),
        ...(countryPreferenceCode
          ? { country: { code: countryPreferenceCode } }
          : {}),
        ...(mode === "NEARBY"
          ? {
              cityId: user.cityId,
              nearbyDiscoveryEnabled: true,
            }
          : {
              meetIntents: { hasSome: intents },
            }),
        blockedUsers: { none: { blockedId: user.id } },
        blockedByUsers: { none: { blockerId: user.id } },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        avatarMediaId: true,
        bio: true,
        lastActiveAt: true,
        locationAudience: true,
        educationAudience: true,
        officialProfileStatus: true,
        officialOrganizationType: true,
        officialOrganizationName: true,
        officialVerifiedAt: true,
        country: { select: { name: true, emoji: true } },
        city: { select: { name: true } },
        university: { select: { name: true, shortName: true } },
      },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
      take: 24,
    });

    return Response.json(
      {
        mode,
        privacy: "APPROXIMATE_ONLY",
        profiles: candidates.map((candidate) => ({
          id: candidate.id,
          username: candidate.username,
          firstName: candidate.firstName,
          lastName: candidate.lastName,
          avatarMediaId: candidate.avatarMediaId,
          bio: candidate.bio,
          lastActiveAt: candidate.lastActiveAt?.toISOString() ?? null,
          location:
            candidate.locationAudience === "PRIVATE"
              ? null
              : {
                  city:
                    mode === "NEARBY"
                      ? "Nearby"
                      : (candidate.city?.name ?? null),
                  countryName: candidate.country?.name ?? null,
                  countryEmoji: candidate.country?.emoji ?? null,
                },
          university:
            candidate.educationAudience === "PRIVATE"
              ? null
              : (candidate.university?.shortName ??
                candidate.university?.name ??
                null),
          official:
            candidate.officialProfileStatus === "APPROVED"
              ? {
                  organizationType: candidate.officialOrganizationType,
                  organizationName: candidate.officialOrganizationName,
                  verifiedAt:
                    candidate.officialVerifiedAt?.toISOString() ?? null,
                }
              : null,
        })),
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
