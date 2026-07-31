import { NextRequest } from "next/server";
import { expireHousingListings } from "@/lib/housing-listings";
import { expireHousingRequests } from "@/lib/housing-requests";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "HOUSING_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  try {
    const [listings, requests] = await Promise.all([
      expireHousingListings(),
      expireHousingRequests(),
    ]);
    return Response.json(
      { listings, requests },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return internalApiError("housing.expire", error);
  }
}

export const GET = handle;
export const POST = handle;
