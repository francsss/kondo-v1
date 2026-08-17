import { NextRequest } from "next/server";
import {
  parseAlipayConfig,
  verifyAlipayNotification,
} from "@/lib/payments/alipay-sandbox";
import { settleAlipayOrder } from "@/lib/study-essentials";

const MAX_NOTIFICATION_BYTES = 64 * 1024;
const FORM_CONTENT_TYPE = "application/x-www-form-urlencoded";

function providerResponse(body: "success" | "failure", status = 200) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
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
  const config = parseAlipayConfig(process.env);
  if (!config) return providerResponse("failure", 503);

  const contentType = request.headers.get("content-type")?.split(";", 1)[0];
  if (contentType?.trim().toLowerCase() !== FORM_CONTENT_TYPE) {
    return providerResponse("failure", 415);
  }

  const body = await readNotificationBody(request).catch(() => undefined);
  if (body === null) return providerResponse("failure", 413);
  if (!body) return providerResponse("failure", 400);

  const params = Object.fromEntries(new URLSearchParams(body));
  const notification = verifyAlipayNotification(params, config);
  if (!notification.verified) return providerResponse("failure", 400);

  try {
    const settlement = await settleAlipayOrder(notification);
    return settlement.accepted
      ? providerResponse("success")
      : providerResponse("failure", 400);
  } catch {
    return providerResponse("failure", 500);
  }
}
