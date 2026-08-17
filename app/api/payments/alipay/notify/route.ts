import { NextRequest } from "next/server";
import { logServerEvent } from "@/lib/logger";
import { getPaymentProvider } from "@/lib/payments/registry";
import { settleVerifiedPayment } from "@/lib/payments/settlement";

export const dynamic = "force-dynamic";

const MAX_NOTIFICATION_BYTES = 64 * 1024;
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

function providerResponse(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function readNotificationBody(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_NOTIFICATION_BYTES
  ) {
    return null;
  }

  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_NOTIFICATION_BYTES) {
      await reader.cancel();
      return null;
    }
    body += decoder.decode(value, { stream: true });
  }

  return body + decoder.decode();
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType?.trim().toLowerCase() !== FORM_CONTENT_TYPE) {
    return providerResponse("failure", 415);
  }

  const rawBody = await readNotificationBody(request).catch(() => undefined);
  if (rawBody === null) return providerResponse("failure", 413);
  if (!rawBody) return providerResponse("failure", 400);

  const provider = getPaymentProvider("ALIPAY");
  let verdict;
  try {
    verdict = await provider.verifyNotification(rawBody);
  } catch (error) {
    logServerEvent("payments.notification.error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return providerResponse("failure", 503);
  }

  if (!verdict.verified) {
    logServerEvent("payments.notification.rejected", {
      reason: verdict.reason,
    });
    return providerResponse("failure", 400);
  }

  const outcome = await settleVerifiedPayment(verdict);
  if (!outcome.settled) {
    if (outcome.status >= 500) return providerResponse("failure", 500);
    logServerEvent("payments.notification.unsettled", {
      reference: verdict.reference,
      reason: outcome.reason,
    });
  }

  return providerResponse(provider.notificationAcknowledgement());
}
