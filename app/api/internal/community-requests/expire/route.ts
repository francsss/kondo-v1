import { NextRequest } from "next/server";
import { closeExpiredCommunityRequests } from "@/lib/community-requests";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request)) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await closeExpiredCommunityRequests(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("community_requests.expire", error);
  }
}

export const GET = handle;
export const POST = handle;
