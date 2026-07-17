import { getPublicProfile, ProfileError } from "@/lib/profiles";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const viewer = await getCurrentUser();
    const profile = await getPublicProfile((await params).id, viewer);
    const isPublic = !viewer && profile.viewer.isOwner === false;
    return Response.json(
      { profile },
      {
        headers: {
          "Cache-Control": isPublic
            ? "public, max-age=60, stale-while-revalidate=60"
            : "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    if (error instanceof ProfileError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("profile.public", error);
  }
}
