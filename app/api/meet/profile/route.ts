import { NextRequest } from "next/server";
import { meetDiscoveryProfileSchema } from "@/features/meet/schemas";
import { logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const profile = await prisma.meetDiscoveryProfile.findUnique({
    where: { userId: user.id },
  });
  return Response.json(
    { profile },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    },
  );
}

export async function PUT(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = meetDiscoveryProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Meet profile.",
    );
  }

  try {
    const [discoveryCity, discoveryUniversity, otherCity] = await Promise.all([
      prisma.city.findFirst({
        where: { id: parsed.data.discoveryCityId, isActive: true },
        select: { id: true },
      }),
      prisma.university.findFirst({
        where: {
          id: parsed.data.discoveryUniversityId,
          isActive: true,
          verified: true,
        },
        select: { id: true, cityId: true },
      }),
      parsed.data.otherCityId
        ? prisma.city.findFirst({
            where: { id: parsed.data.otherCityId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (!discoveryCity) {
      return jsonError("The selected discovery city is unavailable.", 422);
    }
    if (!discoveryUniversity) {
      return jsonError(
        "The selected discovery university is unavailable.",
        422,
      );
    }
    if (discoveryUniversity.cityId !== discoveryCity.id) {
      return jsonError(
        "Choose a university located in the selected discovery city.",
        422,
      );
    }
    if (parsed.data.otherCityId && !otherCity) {
      return jsonError("The selected city is unavailable.", 422);
    }

    const now = new Date();
    const profile = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          gender: parsed.data.gender,
          nearbyDiscoveryEnabled: parsed.data.nearbyVisibility,
          meetIntents: { set: parsed.data.lookingFor },
        },
      });
      return tx.meetDiscoveryProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          ...parsed.data,
          completedAt: now,
        },
        update: {
          ...parsed.data,
          completedAt: now,
        },
      });
    });

    logServerEvent("meet.discovery-profile.saved", {
      userId: user.id,
      nearbyVisibility: profile.nearbyVisibility,
      distanceRange: profile.distanceRange,
      discoveryCityId: profile.discoveryCityId,
      discoveryUniversityId: profile.discoveryUniversityId,
      lookingForCount: profile.lookingFor.length,
      languageCount: profile.preferredLanguages.length,
    });
    return Response.json({ profile });
  } catch (error) {
    return internalApiError("meet.profile.save", error);
  }
}
