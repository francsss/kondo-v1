import { NextRequest } from "next/server";
import { cleanupMediaAssets } from "@/lib/media";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

// Deletes orphaned/expired media assets and retries pending provider deletions.
// Previously only available as the `media:cleanup` CLI script; exposed here so
// it can run on Vercel Cron. Authorized via CRON_SECRET (Vercel Cron) or
// MEDIA_WORKER_SECRET (manual/other schedulers).
async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "MEDIA_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await cleanupMediaAssets(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("media.cleanup", error);
  }
}

export const GET = handle;
export const POST = handle;
