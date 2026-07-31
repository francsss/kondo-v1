import { NextRequest } from "next/server";
import { housingRequestInputSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import {
  createHousingRequest,
  listHousingRequests,
} from "@/lib/housing-requests";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  try {
    return Response.json(
      await listHousingRequests({
        viewerId: user?.id,
        cityId: request.nextUrl.searchParams.get("cityId") || undefined,
        mine: request.nextUrl.searchParams.get("mine") === "true",
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.requests.list", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`housing-request:${user.id}`, 8, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Daily Housing request limit reached.", 429);
  }
  const parsed = housingRequestInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Housing request.",
    );
  }
  try {
    return Response.json(
      await createHousingRequest({
        actorId: user.id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.requests.create", error);
  }
}
