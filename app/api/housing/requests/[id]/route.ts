import { NextRequest } from "next/server";
import { housingRequestInputSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import {
  getHousingRequest,
  updateHousingRequest,
} from "@/lib/housing-requests";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const user = await getCurrentUser();
  try {
    return Response.json(
      await getHousingRequest({
        requestId: (await params).id,
        viewerId: user?.id,
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.requests.get", error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const body = await request.json().catch(() => null);
  const parsed = housingRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid Housing request.",
    );
  }
  try {
    return Response.json(
      await updateHousingRequest({
        actorId: user.id,
        requestId: (await params).id,
        data: parsed.data,
        expectedVersion:
          typeof body?.expectedVersion === "number"
            ? body.expectedVersion
            : undefined,
        meta: getRequestMeta(request),
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.requests.update", error);
  }
}
