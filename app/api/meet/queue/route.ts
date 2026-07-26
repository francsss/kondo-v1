import { NextRequest } from "next/server";
import { z } from "zod";
import { getAfricanCountry } from "@/lib/african-countries";
import { findMeetMatch, leaveMeetQueue } from "@/lib/calls/service";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const matchSchema = z.object({
  gender: z.enum(["MALE", "FEMALE"]),
  genderPreference: z.enum(["ALL", "MALE", "FEMALE"]),
  countryPreferenceCode: z.string().length(2).nullable().default(null),
  mode: z.enum(["RANDOM", "NEARBY", "LOOKING_FOR"]).default("RANDOM"),
  nearbyEnabled: z.boolean().default(false),
  intents: z
    .array(
      z.enum([
        "FRIENDS",
        "STUDY",
        "LANGUAGE",
        "SPORTS",
        "CITY",
        "NETWORKING",
        "COUNTRY",
        "RELATIONSHIP",
      ]),
    )
    .max(8)
    .default([]),
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
    const countryReference = parsed.data.countryPreferenceCode
      ? getAfricanCountry(parsed.data.countryPreferenceCode)
      : null;
    if (parsed.data.countryPreferenceCode && !countryReference) {
      return jsonError("Select a valid African country.");
    }
    if (parsed.data.mode === "NEARBY" && !parsed.data.nearbyEnabled) {
      return jsonError("Enable approximate nearby discovery to continue.", 422);
    }
    if (parsed.data.mode === "LOOKING_FOR" && !parsed.data.intents.length) {
      return jsonError("Choose at least one reason for meeting.", 422);
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
      gender: parsed.data.gender,
      genderPreference: parsed.data.genderPreference,
      countryPreferenceId: country?.id ?? null,
      mode: parsed.data.mode,
      nearbyEnabled: parsed.data.nearbyEnabled,
      intents: parsed.data.intents,
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
