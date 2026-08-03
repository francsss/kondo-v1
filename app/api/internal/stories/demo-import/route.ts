import { NextRequest } from "next/server";
import { importProductionDemoStories } from "@/lib/demo-stories-production";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "MEDIA_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  if (request.headers.get("x-kondo-demo-import") !== "publish-10-stories") {
    return jsonError("Explicit import confirmation is required.", 400);
  }

  try {
    return Response.json(await importProductionDemoStories(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("stories.demo_import", error);
  }
}
