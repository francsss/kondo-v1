import { NextRequest } from "next/server";
import { processNotificationJobs } from "@/lib/notifications";
import { internalApiError, jsonError } from "@/lib/request";
import { generateSmartNotificationJobs } from "@/lib/smart-notifications";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "NOTIFICATION_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  try {
    const generated = await generateSmartNotificationJobs();
    const processed = await processNotificationJobs(200);
    return Response.json(
      { generated, processed },
      {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      },
    );
  } catch (error) {
    return internalApiError("notifications.worker", error);
  }
}

// POST is used by the GitHub scheduler. GET remains compatible with Vercel
// Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
export const GET = handle;
export const POST = handle;
