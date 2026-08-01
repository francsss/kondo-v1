import { authorizeAdminApi } from "@/lib/admin-auth";
import { getMessageSafetyOverview, MessagingError } from "@/lib/messaging";
import { internalApiError, jsonError } from "@/lib/request";

export async function GET() {
  const auth = await authorizeAdminApi("MESSAGE_SAFETY_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return Response.json(await getMessageSafetyOverview(auth.user), {
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
