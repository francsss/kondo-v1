import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { logServerEvent } from "@/lib/logger";
import { PaymentConfigurationError } from "@/lib/payments/provider";
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

/**
 * Start a payment.
 *
 * The browser sends a slug. It does not send a price, and if it did it would
 * be ignored: the amount is read from the catalogue row here, so a member
 * cannot buy a textbook for one cent by editing a request.
 *
 * Nothing is granted by this endpoint. It creates a PENDING order and hands
 * back what the browser needs to reach Alipay; the entitlement waits for the
 * verified notification.
 */

export const dynamic = "force-dynamic";

const schema = z.object({ slug: z.string().trim().min(1).max(180) });

/** Alipay's `out_trade_no` allows 64 chars; this stays well inside it. */
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

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    return jsonError("Invalid request origin.", 403);

  const user = await getCurrentUser();
  if (!user) return jsonError("Authentication required.", 401);

  // Starting a payment creates a row and calls a gateway, so it is worth
  // bounding per member as well as per IP.
  const limit = await rateLimit(`books:pay:${user.id}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return jsonError("Too many payment attempts. Try again shortly.", 429);
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Choose a title to buy.");

  try {
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
      // The pilot title is public domain. Selling it outside the pilot would
      // present a free work as a commercial product.
      return jsonError("Book purchases are not open on this environment.", 409);
    }

    const existing = await checkEntitlement({
      userId: user.id,
      essentialId: essential.id,
    });
    if (existing.allowed) {
      return jsonError("You already have access to this title.", 409);
    }

    const provider = getPaymentProvider("ALIPAY");
    assertPaymentsUsable(provider);

    const reference = orderReference();
    const order = await prisma.studyEssentialOrder.create({
      data: {
        reference,
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
      },
      select: { id: true, reference: true, totalMinor: true, currency: true },
    });

    const handoff = await provider.createPayment({
      reference: order.reference,
      amountMinor: order.totalMinor,
      currency: order.currency,
      subject: essential.title,
      returnUrl:
        process.env.ALIPAY_RETURN_URL?.trim() ||
        absoluteUrl(`/student-hub/books/payment?reference=${order.reference}`),
      notifyUrl:
        process.env.ALIPAY_NOTIFY_URL?.trim() ||
        absoluteUrl("/api/payments/alipay/notify"),
    });

    logServerEvent("payments.created", {
      provider: "ALIPAY",
      reference: order.reference,
      ip: requestIp(request),
    });

    return Response.json(
      { reference: order.reference, handoff },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      // Surfaced rather than swallowed: an operator needs to know a payment
      // could not start because credentials are missing, not see it silently
      // succeed or fail as a generic error.
      return jsonError(error.message, 503);
    }
    return internalApiError("payments.alipay.create", error);
  }
}
