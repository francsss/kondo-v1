import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getRequestMeta,
  hasTrustedOrigin,
  internalApiError,
  jsonError,
} from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";
import { parseAlipayConfig } from "@/lib/payments/alipay-sandbox";
import {
  placeAlipayOrder,
  placeSimulatedOrder,
  StudyEssentialError,
} from "@/lib/study-essentials";

const orderSchema = z.object({
  slug: z.string().trim().min(1).max(180),
  quantity: z.number().int().min(1).max(10).default(1),
  // Only SIMULATED is accepted today; the domain rejects the rest with a
  // readable message so the checkout can explain why.
  paymentProvider: z
    .enum(["SIMULATED", "ALIPAY", "WECHAT_PAY", "CARD"])
    .default("SIMULATED"),
});

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }
  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid order.");
  }

  try {
    if (parsed.data.paymentProvider === "ALIPAY") {
      const config = parseAlipayConfig(process.env);
      if (!config) {
        return jsonError("Alipay sandbox is not configured.", 503);
      }
      const result = await placeAlipayOrder({
        userId: user.id,
        slug: parsed.data.slug,
        quantity: parsed.data.quantity,
        config,
        ...getRequestMeta(request),
      });
      return Response.json({
        ok: true,
        order: {
          reference: result.order.reference,
          status: result.order.status,
        },
        payment: result.payment,
      });
    }

    const order = await placeSimulatedOrder({
      userId: user.id,
      slug: parsed.data.slug,
      quantity: parsed.data.quantity,
      paymentProvider: parsed.data.paymentProvider,
      ...getRequestMeta(request),
    });
    return Response.json({
      ok: true,
      order: { reference: order.reference, status: order.status },
    });
  } catch (error) {
    if (error instanceof StudyEssentialError) {
      return jsonError(error.message, error.status);
    }
    return internalApiError("studyEssentials.order", error);
  }
}
