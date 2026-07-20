import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getUserPreferences, updateUserPreferences } from "@/lib/settings";
import { getCurrentUser } from "@/lib/server-auth";
import { settingsPreferencesSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      { preferences: await getUserPreferences(user.id) },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("settings.preferences", error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!(await rateLimit(`settings:${user.id}`, 60, 60 * 60_000)).allowed) {
    return jsonError("Settings update limit reached. Try again later.", 429);
  }
  const parsed = settingsPreferencesSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError(
      parsed.success
        ? "Provide at least one preference."
        : (parsed.error.issues[0]?.message ?? "Invalid preferences."),
    );
  }
  try {
    const preferences = await updateUserPreferences(
      user.id,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ preferences });
  } catch (error) {
    return internalApiError("settings.preferences.update", error);
  }
}
