import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { processNotificationJobs } from "@/lib/notifications";
import { internalApiError, jsonError } from "@/lib/request";

export async function POST(request: NextRequest) {
  const secret = process.env.NOTIFICATION_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  const expected = secret ? Buffer.from(`Bearer ${secret}`) : null;
  const received = authorization ? Buffer.from(authorization) : null;
  if (
    !expected ||
    !received ||
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return jsonError("Authentication required.", 401);
  }
  try {
    return Response.json(await processNotificationJobs(100), {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return internalApiError("notifications.worker", error);
  }
}
