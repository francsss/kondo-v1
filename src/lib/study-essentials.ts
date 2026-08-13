import { randomBytes } from "node:crypto";
import type {
  Prisma,
  StudyEssentialFormat,
  StudyEssentialPaymentProvider,
} from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * Study Essentials — a curated academic catalogue owned by Kondo.
 *
 * Two sources share one catalogue. `KONDO` items are sold through Kondo and
 * can be ordered; `PARTNER` items are published by publishers, universities
 * and education companies and always send the student to the partner's own
 * platform. Nothing here charges a card: the MVP records a simulated payment
 * and keeps the provider on the order so a real adapter can replace it later
 * without touching the catalogue or the order shape.
 */

export class StudyEssentialError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

export const STUDY_ESSENTIAL_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "digital", label: "Digital" },
  { key: "physical", label: "Physical" },
  { key: "partner", label: "From partners" },
] as const;

export type StudyEssentialFilterKey =
  (typeof STUDY_ESSENTIAL_FILTERS)[number]["key"];

export function isStudyEssentialFilter(
  value: string | undefined,
): value is StudyEssentialFilterKey {
  return STUDY_ESSENTIAL_FILTERS.some(({ key }) => key === value);
}

/** Simulated payment methods offered at checkout. */
export const STUDY_ESSENTIAL_PAYMENT_METHODS = [
  {
    key: "SIMULATED" as const,
    label: "Kondo demo payment",
    hint: "No money moves. This records a demo order so you can see the flow.",
    available: true,
  },
  {
    key: "ALIPAY" as const,
    label: "Alipay",
    hint: "Coming soon.",
    available: false,
  },
  {
    key: "WECHAT_PAY" as const,
    label: "WeChat Pay",
    hint: "Coming soon.",
    available: false,
  },
] as const;

const listSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  category: true,
  format: true,
  source: true,
  priceMinor: true,
  currency: true,
  providerName: true,
  externalUrl: true,
  imageUrl: true,
  coverEmoji: true,
} satisfies Prisma.StudyEssentialSelect;

export type StudyEssentialListItem = Prisma.StudyEssentialGetPayload<{
  select: typeof listSelect;
}>;

export function formatEssentialPrice(
  priceMinor: number | null,
  currency: string,
) {
  if (priceMinor === null) return null;
  if (priceMinor === 0) return "Free";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    // See `formatPrice`: the price is the loudest thing on a card, so it gets
    // the symbol a shopper recognises rather than the disambiguating form.
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: priceMinor % 100 === 0 ? 0 : 2,
  }).format(priceMinor / 100);
}

function filterWhere(
  filter: StudyEssentialFilterKey,
): Prisma.StudyEssentialWhereInput {
  if (filter === "digital") return { format: "DIGITAL" };
  if (filter === "physical") return { format: "PHYSICAL" };
  if (filter === "partner") return { source: "PARTNER" };
  return {};
}

export async function listStudyEssentials(
  filter: StudyEssentialFilterKey = "all",
) {
  return prisma.studyEssential.findMany({
    where: { status: "PUBLISHED", ...filterWhere(filter) },
    select: listSelect,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function countStudyEssentialsByFilter() {
  const published = await prisma.studyEssential.findMany({
    where: { status: "PUBLISHED" },
    select: { format: true, source: true },
  });
  return {
    all: published.length,
    digital: published.filter((item) => item.format === "DIGITAL").length,
    physical: published.filter((item) => item.format === "PHYSICAL").length,
    partner: published.filter((item) => item.source === "PARTNER").length,
  } satisfies Record<StudyEssentialFilterKey, number>;
}

export async function getStudyEssential(slug: string) {
  return prisma.studyEssential.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
}

/** Only a Kondo-sourced item with a real price can be ordered on Kondo. */
export function isOrderable(essential: {
  source: string;
  priceMinor: number | null;
  externalUrl: string | null;
}) {
  return essential.source === "KONDO" && essential.priceMinor !== null;
}

function orderReference() {
  return `KS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * Records a simulated purchase.
 *
 * The order is written PENDING and settled to PAID in the same transaction:
 * a real provider will instead settle it from a webhook, which is why the
 * status and payment reference are stored rather than implied.
 */
export async function placeSimulatedOrder(input: {
  userId: string;
  slug: string;
  quantity: number;
  paymentProvider: StudyEssentialPaymentProvider;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new StudyEssentialError("Choose a quantity of at least one.");
  }
  if (input.quantity > 10) {
    throw new StudyEssentialError(
      "A single demo order is limited to ten items.",
    );
  }
  if (input.paymentProvider !== "SIMULATED") {
    throw new StudyEssentialError(
      "Only the Kondo demo payment is available right now.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const essential = await tx.studyEssential.findFirst({
      where: { slug: input.slug, status: "PUBLISHED" },
    });
    if (!essential) {
      throw new StudyEssentialError("This item is no longer available.", 404);
    }
    if (!isOrderable(essential)) {
      throw new StudyEssentialError(
        "This item is provided by a partner and is bought on their platform.",
      );
    }

    const unitPriceMinor = essential.priceMinor ?? 0;
    const now = new Date();
    const order = await tx.studyEssentialOrder.create({
      data: {
        reference: orderReference(),
        userId: input.userId,
        essentialId: essential.id,
        titleSnapshot: essential.title,
        formatSnapshot: essential.format,
        quantity: input.quantity,
        unitPriceMinor,
        totalMinor: unitPriceMinor * input.quantity,
        currency: essential.currency,
        // Settled immediately because the payment is simulated. A real
        // provider leaves this PENDING until its webhook confirms.
        status: "PAID",
        paymentProvider: input.paymentProvider,
        paymentReference: `demo_${randomBytes(6).toString("hex")}`,
        placedAt: now,
        paidAt: now,
      },
    });

    await writeAuditLogWithClient(tx, {
      actorId: input.userId,
      action: "STUDY_ESSENTIAL_ORDER_PLACED",
      entityType: "StudyEssentialOrder",
      entityId: order.id,
      newValue: {
        reference: order.reference,
        essentialId: essential.id,
        quantity: order.quantity,
        totalMinor: order.totalMinor,
        currency: order.currency,
        paymentProvider: order.paymentProvider,
        simulated: true,
      },
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return order;
  });
}

export async function getStudyEssentialOrder(
  userId: string,
  reference: string,
) {
  return prisma.studyEssentialOrder.findFirst({
    where: { reference, userId },
    include: {
      essential: {
        select: {
          slug: true,
          title: true,
          coverEmoji: true,
          imageUrl: true,
          format: true,
          category: true,
        },
      },
    },
  });
}

export async function listStudyEssentialOrders(userId: string) {
  return prisma.studyEssentialOrder.findMany({
    where: { userId },
    orderBy: { placedAt: "desc" },
    include: {
      essential: { select: { slug: true, coverEmoji: true, imageUrl: true } },
    },
  });
}

export type StudyEssentialFormatKey = StudyEssentialFormat;
