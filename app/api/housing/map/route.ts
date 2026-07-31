import { NextRequest } from "next/server";
import { listHousingMapPoints } from "@/lib/housing-search";
import { internalApiError } from "@/lib/request";

function number(value: string | null) {
  const parsed = value == null ? undefined : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  try {
    return Response.json(
      await listHousingMapPoints({
        cityId: params.get("cityId") || undefined,
        north: number(params.get("north")),
        south: number(params.get("south")),
        east: number(params.get("east")),
        west: number(params.get("west")),
        limit: number(params.get("limit")),
      }),
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=90",
        },
      },
    );
  } catch (error) {
    return internalApiError("housing.map", error);
  }
}
