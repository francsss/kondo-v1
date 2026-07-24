import { NextRequest } from "next/server";
import { internalApiError, jsonError } from "@/lib/request";
import { publishScheduledStories } from "@/lib/stories";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request)) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await publishScheduledStories(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("stories.publish_scheduled", error);
  }
}

export const GET = handle;
export const POST = handle;
