import { listSavedHousing } from "@/lib/housing-saved";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(await listSavedHousing(user.id));
  } catch (error) {
    return internalApiError("housing.saved.list", error);
  }
}
