import type { NextRequest } from "next/server";
import { z } from "zod";
import { setNavigatorActionState } from "@/lib/navigator";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";

const schema = z.object({
  state: z.enum(["COMPLETED", "DISMISSED", "DEFERRED"]),
  deferDays: z.number().int().min(1).max(14).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ actionKey: string }> },
) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`navigator:${user.id}`, 120, 60 * 60_000)).allowed) {
    return jsonError(
      "Too many Navigator updates. Please try again later.",
      429,
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid action state.",
    );
  try {
    const { actionKey } = await context.params;
    const state = await setNavigatorActionState({
      userId: user.id,
      actionKey,
      ...parsed.data,
    });
    return Response.json({ state });
  } catch (error) {
    if (error instanceof Error && error.message === "Unknown Navigator action.")
      return jsonError(error.message, 404);
    return internalApiError("navigator.action", error);
  }
}
