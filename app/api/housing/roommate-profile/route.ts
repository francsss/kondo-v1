import { NextRequest } from "next/server";
import { roommateProfileInputSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import {
  getRoommateProfile,
  upsertRoommateProfile,
} from "@/lib/roommate-profiles";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const profile = await prisma.roommateProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!profile) return Response.json(null);
  try {
    return Response.json(
      await getRoommateProfile({ viewerId: user.id, profileId: profile.id }),
    );
  } catch (error) {
    return housingApiFailure("housing.roommate-profile.get", error);
  }
}

export async function POST(request: NextRequest) {
  return save(request);
}

export async function PATCH(request: NextRequest) {
  return save(request);
}

async function save(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const body = await request.json().catch(() => null);
  const parsed = roommateProfileInputSchema.safeParse(body);
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid roommate profile.",
    );
  try {
    return Response.json(
      await upsertRoommateProfile({
        actorId: user.id,
        data: parsed.data,
        expectedVersion:
          typeof body?.expectedVersion === "number"
            ? body.expectedVersion
            : undefined,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.roommate-profile.save", error);
  }
}
