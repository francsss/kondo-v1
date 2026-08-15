import { NextRequest } from "next/server";
import { logServerEvent } from "@/lib/logger";
import {
  getNearbyStudents,
  getViewerStudyPoint,
  NEARBY_PAGE_SIZE,
  type NearbyFilter,
} from "@/lib/nearby-students";
import { internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const FILTERS: NearbyFilter[] = ["ALL", "UNIVERSITY", "CITY"];

function parseFilter(value: string | null): NearbyFilter {
  return FILTERS.includes(value as NearbyFilter)
    ? (value as NearbyFilter)
    : "ALL";
}

/**
 * Nearby results for the signed-in student.
 *
 * A GET so paging can be cached per viewer for a short window: the underlying
 * data is a city's student roster, which does not change by the second, and
 * re-running the ranking on every back-navigation was one of the things that
 * made the old surface feel slow. It is `private` because the ranking is
 * computed from who is asking.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const url = new URL(request.url);
  const filter = parseFilter(url.searchParams.get("filter"));
  const cursor = url.searchParams.get("cursor");

  try {
    const point = await getViewerStudyPoint(user);
    const result = await getNearbyStudents({
      viewer: {
        id: user.id,
        cityId: user.cityId,
        universityId: user.universityId,
        degree: user.degree,
        point,
      },
      filter,
      cursor,
    });

    logServerEvent("community.nearby.listed", {
      userId: user.id,
      filter,
      paged: Boolean(cursor),
      resultCount: result.students.length,
    });

    return Response.json(
      {
        students: result.students,
        nextCursor: result.nextCursor,
        pageSize: NEARBY_PAGE_SIZE,
        // Stated so a client can never assume it may ask for coordinates.
        privacy: "NO_COORDINATES",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=120",
          Vary: "Cookie",
        },
      },
    );
  } catch (error) {
    return internalApiError("community.nearby", error);
  }
}
