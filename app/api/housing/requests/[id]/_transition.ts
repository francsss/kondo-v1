import { NextRequest } from "next/server";
import type { HousingRequestStatus } from "@prisma/client";
import { housingApiFailure } from "@/lib/housing-api";
import { transitionHousingRequest } from "@/lib/housing-requests";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export function createRequestTransitionHandler(to: HousingRequestStatus) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) {
    if (!hasTrustedOrigin(request))
      return jsonError("Invalid request origin.", 403);
    const user = await getCurrentUser();
    if (!user) return jsonError("Authentication required.", 401);
    const body = await request.json().catch(() => ({}));
    try {
      return Response.json(
        await transitionHousingRequest({
          actorId: user.id,
          requestId: (await params).id,
          to,
          expectedVersion:
            typeof body?.expectedVersion === "number"
              ? body.expectedVersion
              : undefined,
          meta: getRequestMeta(request),
        }),
      );
    } catch (error) {
      return housingApiFailure(`housing.requests.${to.toLowerCase()}`, error);
    }
  };
}
