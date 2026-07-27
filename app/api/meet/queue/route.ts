import { NextRequest } from "next/server";
import { z } from "zod";
import { getAfricanCountry } from "@/lib/african-countries";
import { findMeetMatch, leaveMeetQueue } from "@/lib/calls/service";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const matchSchema = z.object({
  countryPreferenceCode: z.string().length(2).nullable().default(null),
  mode: z.literal("RANDOM").default("RANDOM"),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = matchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid preferences.");
  }
  try {
    const profile = await prisma.meetDiscoveryProfile.findUnique({
      where: { userId: user.id },
    });
    if (
      !profile?.completedAt ||
      !profile.discoveryCityId ||
      !profile.discoveryUniversityId
    ) {
      return Response.json(
        {
          error: "Complete your Meet Discovery Profile before matching.",
          code: "MEET_PROFILE_REQUIRED",
        },
        { status: 428 },
      );
    }
    const countryReference = parsed.data.countryPreferenceCode
      ? getAfricanCountry(parsed.data.countryPreferenceCode)
      : null;
    if (parsed.data.countryPreferenceCode && !countryReference) {
      return jsonError("Select a valid African country.");
    }
    const country = countryReference
      ? await prisma.country.upsert({
          where: { code: countryReference.code },
          create: { ...countryReference, isActive: true, verified: true },
          update: { isActive: true, emoji: countryReference.emoji },
          select: { id: true },
        })
      : null;
    const result = await findMeetMatch({
      userId: user.id,
      gender: profile.gender,
      genderPreference: profile.interestedIn,
      countryPreferenceId: country?.id ?? null,
      mode: "RANDOM",
      nearbyEnabled: profile.nearbyVisibility,
      intents: profile.lookingFor,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return internalApiError("meet.queue", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    await leaveMeetQueue(user.id);
    return Response.json({ queued: false });
  } catch (error) {
    return internalApiError("meet.leave", error);
  }
}
