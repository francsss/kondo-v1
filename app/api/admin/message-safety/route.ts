import { getMessageSafetyOverview, MessagingError } from "@/lib/messaging";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(await getMessageSafetyOverview(user), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    if (error instanceof MessagingError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("admin.message-safety", error);
  }
}
