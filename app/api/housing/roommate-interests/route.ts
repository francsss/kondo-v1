import { NextRequest } from "next/server";
import { roommateInterestSchema } from "@/features/housing/schemas";
import { housingApiFailure } from "@/lib/housing-api";
import {
  listRoommateInterests,
  sendRoommateInterest,
} from "@/lib/roommate-matching";
import { rateLimit } from "@/lib/rate-limit";
import { getRequestMeta, hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  return Response.json(await listRoommateInterests(user.id));
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`roommate-interest:${user.id}`, 20, 24 * 60 * 60_000))
      .allowed
  ) {
    return jsonError("Daily roommate interest limit reached.", 429);
  }
  const parsed = roommateInterestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid interest.");
  try {
    return Response.json(
      await sendRoommateInterest({
        actorId: user.id,
        data: parsed.data,
        meta: getRequestMeta(request),
      }),
      { status: 201 },
    );
  } catch (error) {
    return housingApiFailure("housing.roommate-interest.create", error);
  }
}
