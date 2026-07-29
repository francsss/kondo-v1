import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getPushSubscriptionStatus,
  removePushSubscription,
  savePushSubscription,
} from "@/lib/push-notifications";
import { hasTrustedOrigin, internalApiError, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(4096)
    .refine((value) => value.startsWith("https://"), {
      message: "Push subscription endpoints must use HTTPS.",
    }),
  expirationTime: z.number().positive().nullable().optional(),
  keys: z.object({
    auth: z.string().min(8).max(512),
    p256dh: z.string().min(16).max(512),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(4096)
    .refine((value) => value.startsWith("https://"), {
      message: "Push subscription endpoints must use HTTPS.",
    })
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  try {
    return Response.json(await getPushSubscriptionStatus(user.id), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    });
  } catch (error) {
    return internalApiError("notifications.push.status", error);
  }
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = subscriptionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues[0]?.message ?? "Invalid push subscription.",
    );
  }
  try {
    return Response.json(
      await savePushSubscription(
        user.id,
        parsed.data,
        request.headers.get("user-agent"),
      ),
    );
  } catch (error) {
    return internalApiError("notifications.push.subscribe", error);
  }
}

export async function DELETE(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);
  const parsed = unsubscribeSchema.safeParse(
    await request.json().catch(() => ({})),
  );
  if (!parsed.success) return jsonError("Invalid push subscription.");
  try {
    return Response.json(
      await removePushSubscription(user.id, parsed.data.endpoint),
    );
  } catch (error) {
    return internalApiError("notifications.push.unsubscribe", error);
  }
}
