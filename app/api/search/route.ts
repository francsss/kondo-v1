import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { internalApiError, jsonError, requestIp } from "@/lib/request";
import {
  SEARCH_CATEGORIES,
  searchCategory,
  searchKondo,
  SearchError,
  type SearchCategory as SearchCategoryType,
} from "@/lib/search";
import { getCurrentUser } from "@/lib/server-auth";

function isSearchCategory(value: string | null): value is SearchCategoryType {
  return (SEARCH_CATEGORIES as readonly string[]).includes(value ?? "");
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  if (
    !(await rateLimit(`search:${user.id}:${requestIp(request)}`, 60, 60_000))
      .allowed
  )
    return jsonError("Search limit reached.", 429);
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100)
    return jsonError("Search must be between 2 and 100 characters.");
  const type = params.get("type");
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    Vary: "Cookie",
  };
  try {
    if (type !== null) {
      if (!isSearchCategory(type)) return jsonError("Unknown search category.");
      const cursor = params.get("cursor") ?? undefined;
      const limit = params.get("limit")
        ? Number(params.get("limit"))
        : undefined;
      return Response.json(
        await searchCategory(type, query, user.id, { cursor, limit }),
        { headers },
      );
    }
    return Response.json(await searchKondo(query, user.id), { headers });
  } catch (error) {
    if (error instanceof SearchError)
      return jsonError(error.message, error.status);
    return internalApiError("search.query", error);
  }
}
