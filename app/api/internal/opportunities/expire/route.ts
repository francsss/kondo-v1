import { NextRequest } from "next/server";
import { expireOpportunities } from "@/lib/opportunity-management";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "OPPORTUNITY_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await expireOpportunities(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("opportunities.expire", error);
  }
}

export const GET = handle;
export const POST = handle;
