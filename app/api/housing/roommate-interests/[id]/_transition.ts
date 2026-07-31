import { NextRequest } from "next/server";
import type { RoommateInterestStatus } from "@prisma/client";
import { housingApiFailure } from "@/lib/housing-api";
import { transitionRoommateInterest } from "@/lib/roommate-matching";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export function createInterestTransitionHandler(
  to: Extract<RoommateInterestStatus, "ACCEPTED" | "DECLINED" | "WITHDRAWN">,
) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    try {
      return Response.json(
        await transitionRoommateInterest({
          actorId: user.id,
          interestId: (await params).id,
          to,
          meta: getRequestMeta(request),
        }),
      );
    } catch (error) {
      return housingApiFailure(
        `housing.roommate-interest.${to.toLowerCase()}`,
        error,
      );
    }
  };
}
