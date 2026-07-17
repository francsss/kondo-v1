import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { internalApiError, jsonError, requestIp } from "@/lib/request";
import { searchKondo } from "@/lib/platform-queries";
import { getCurrentUser } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (!rateLimit(`search:${user.id}:${requestIp(request)}`, 60, 60_000).allowed)
    return jsonError("Search limit reached.", 429);
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100)
    return jsonError("Search must be between 2 and 100 characters.");
  try {
    return Response.json(await searchKondo(query, user.id), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return internalApiError("search.query", error);
  }
}
