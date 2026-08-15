import { NextRequest } from "next/server";
import { logServerEvent } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

/**
 * The one control Nearby needs: whether you appear in it.
 *
 * `User.nearbyDiscoveryEnabled` already existed and already defaulted to true,
 * but the only way to reach it was the Meet discovery profile — which asks for
 * a gender and an age range before it will save anything. That left a student
 * who never opened Meet discoverable with no switch they could find. This
 * writes that single field and nothing else.
 */
export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const body = (await request.json().catch(() => null)) as {
    discoverable?: unknown;
  } | null;
  if (typeof body?.discoverable !== "boolean") {
    return jsonError("Provide whether you want to be discoverable.");
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { nearbyDiscoveryEnabled: body.discoverable },
    });
    logServerEvent("community.nearby.visibility-changed", {
      userId: user.id,
      discoverable: body.discoverable,
    });
    return Response.json(
      { discoverable: body.discoverable },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return internalApiError("community.nearby.visibility", error);
  }
}
