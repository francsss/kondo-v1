import { NextRequest } from "next/server";
import { sendDueEmailDigests } from "@/lib/email-digest";
import { internalApiError, jsonError } from "@/lib/request";
import { isAuthorizedWorkerRequest } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  if (!isAuthorizedWorkerRequest(request, "NOTIFICATION_WORKER_SECRET")) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await sendDueEmailDigests(), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("notifications.digest", error);
  }
}

// GET is used by Vercel Cron; POST remains for manual triggers.
export const GET = handle;
export const POST = handle;
