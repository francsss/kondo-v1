import { NextRequest } from "next/server";
import {
  getOwnProfileSettings,
  ProfileError,
  updateProfile,
} from "@/lib/profiles";
import { rateLimit } from "@/lib/rate-limit";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { profileUpdateSchema } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      { profile: await getOwnProfileSettings(user.id) },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("profile.settings", error);
  }
}

export async function PATCH(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`profile-update:${user.id}`, 30, 24 * 60 * 60_000).allowed) {
    return jsonError("Profile update limit reached. Try again later.", 429);
  }
  const parsed = profileUpdateSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return jsonError(
      parsed.success
        ? "Provide at least one profile field."
        : (parsed.error.issues[0]?.message ?? "Invalid profile update."),
    );
  }
  try {
    const profile = await updateProfile(
      user,
      parsed.data,
      getRequestMeta(request),
    );
    return Response.json({ profile });
  } catch (error) {
    if (error instanceof ProfileError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("profile.update", error);
  }
}
