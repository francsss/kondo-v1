import { housingApiFailure } from "@/lib/housing-api";
import { getRoommateProfile } from "@/lib/roommate-profiles";
import { jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(
      await getRoommateProfile({
        viewerId: user.id,
        profileId: (await params).id,
      }),
    );
  } catch (error) {
    return housingApiFailure("housing.roommates.get", error);
  }
}
