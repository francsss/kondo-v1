import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { logServerEvent } from "@/lib/logger";
import {
  PaymentConfigurationError,
  type PaymentProvider,
} from "@/lib/payments/provider";
import {
  assertPaymentsUsable,
  getPaymentProvider,
  isBooksPilotMode,
} from "@/lib/payments/registry";
import { prisma } from "@/lib/prisma";
import {
  hasTrustedOrigin,
  internalApiError,
  jsonError,
  requestIp,
} from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/server-auth";
import { checkEntitlement } from "@/lib/study-entitlements";

export const dynamic = "force-dynamic";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const schema = z.object({ slug: z.string().trim().min(1).max(180) });

function orderReference() {
  return `KB${Date.now().toString(36).toUpperCase()}${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function absoluteUrl(path: string) {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    ""
  ).replace(/\/$/, "");
  return `${base}${path}`;
}

type PaymentOrder = {
  reference: string;
  status: string;
  totalMinor: number;
  currency: string;
  placedAt: Date;
  essential: { slug: string; title: string };
};

function assertMatchingRetry(order: PaymentOrder, slug: string) {
  if (order.essential.slug !== slug) {
    throw new IdempotencyConflictError();
  }
}

class IdempotencyConflictError extends Error {}

async function paymentResponse(order: PaymentOrder, provider: PaymentProvider) {
  if (order.status !== "PENDING") {
    return Response.json(
      { reference: order.reference, status: order.status, handoff: null },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  }

  const handoff = await provider.createPayment({
    reference: order.reference,
    amountMinor: order.totalMinor,
    currency: order.currency,
    subject: order.essential.title,
    returnUrl:
      process.env.ALIPAY_RETURN_URL?.trim() ||
      absoluteUrl(`/student-hub/books/payment?reference=${order.reference}`),
    notifyUrl:
      process.env.ALIPAY_NOTIFY_URL?.trim() ||
      absoluteUrl("/api/payments/alipay/notify"),
    createdAt: order.placedAt,
  });

  return Response.json(
    { reference: order.reference, status: order.status, handoff },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

async function findIdempotentOrder(userId: string, idempotencyKey: string) {
  return prisma.studyEssentialOrder.findUnique({
    where: {
      userId_paymentProvider_idempotencyKey: {
        userId,
        paymentProvider: "ALIPAY",
        idempotencyKey,
      },
    },
    select: {
      reference: true,
      status: true,
      totalMinor: true,
      currency: true,
      placedAt: true,
      essential: { select: { slug: true, title: true } },
    },
  });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a title to buy.");

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || !IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    return jsonError(
      "A valid Idempotency-Key header is required for Alipay checkout.",
    );
  }

  const provider = getPaymentProvider("ALIPAY");

  try {
    const existing = await findIdempotentOrder(user.id, idempotencyKey);
    if (existing) {
      assertMatchingRetry(existing, parsed.data.slug);
      if (existing.status === "PENDING") assertPaymentsUsable(provider);
      return paymentResponse(existing, provider);
    }

    const limit = await rateLimit(`books:pay:${user.id}`, 10, 10 * 60_000);
    if (!limit.allowed) {
      return jsonError("Too many payment attempts. Try again shortly.", 429);
    }

    const essential = await prisma.studyEssential.findFirst({
      where: { slug: parsed.data.slug, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        title: true,
        format: true,
        source: true,
        priceMinor: true,
        currency: true,
      },
    });
    if (!essential) return jsonError("This title is not available.", 404);
    if (essential.source === "PARTNER") {
      return jsonError("This title is bought on the partner's platform.", 409);
    }
    if (essential.priceMinor === null) {
      return jsonError("This title has no price set.", 409);
    }
    if (essential.priceMinor === 0) {
      return jsonError("This title is free — it does not need a payment.", 409);
    }
    if (!isBooksPilotMode()) {
      return jsonError("Book purchases are not open on this environment.", 409);
    }

    const entitlement = await checkEntitlement({
      userId: user.id,
      essentialId: essential.id,
    });
    if (entitlement.allowed) {
      return jsonError("You already have access to this title.", 409);
    }

    assertPaymentsUsable(provider);
    const order = await prisma.studyEssentialOrder.create({
      data: {
        reference: orderReference(),
        userId: user.id,
        essentialId: essential.id,
        titleSnapshot: essential.title,
        formatSnapshot: essential.format,
        quantity: 1,
        unitPriceMinor: essential.priceMinor,
        totalMinor: essential.priceMinor,
        currency: essential.currency,
        status: "PENDING",
        paymentProvider: "ALIPAY",
        idempotencyKey,
      },
      select: {
        reference: true,
        status: true,
        totalMinor: true,
        currency: true,
        placedAt: true,
        essential: { select: { slug: true, title: true } },
      },
    });

    logServerEvent("payments.created", {
      provider: "ALIPAY",
      reference: order.reference,
      ip: requestIp(request),
    });
    return paymentResponse(order, provider);
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return jsonError(
        "This Idempotency-Key was already used for a different order.",
        409,
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await findIdempotentOrder(user.id, idempotencyKey);
      if (existing) {
        try {
          assertMatchingRetry(existing, parsed.data.slug);
          if (existing.status === "PENDING") assertPaymentsUsable(provider);
          return paymentResponse(existing, provider);
        } catch (retryError) {
          if (retryError instanceof IdempotencyConflictError) {
            return jsonError(
              "This Idempotency-Key was already used for a different order.",
              409,
            );
          }
          throw retryError;
        }
      }
    }
    if (error instanceof PaymentConfigurationError) {
      return jsonError(error.message, 503);
    }
    return internalApiError("payments.alipay.create", error);
  }
}
