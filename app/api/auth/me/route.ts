import { internalApiError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { toSafeUser } from "@/lib/serializers";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json(
        { user: null },
        {
          status: 401,
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
            Vary: "Cookie",
          },
        },
      );
    }
    return Response.json(
      { user: toSafeUser(user) },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("auth.me", error);
  }
}
