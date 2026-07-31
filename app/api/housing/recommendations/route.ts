import { getHousingRecommendations } from "@/lib/housing-search";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(await getHousingRecommendations(user.id));
  } catch (error) {
    return internalApiError("housing.recommendations", error);
  }
}
