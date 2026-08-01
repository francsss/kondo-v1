import type {
  OrganizationCatalogPriceType,
  OrganizationProductStatus,
  OrganizationServiceStatus,
  Prisma,
} from "@prisma/client";
import type { CatalogResourceInput } from "@/features/catalog/schemas";
import { writeAuditLog, writeAuditLogWithClient } from "@/lib/audit";
import { createDirectMessage } from "@/lib/messaging";
import { enqueueNotificationJobWithClient } from "@/lib/notifications";
import { revalidateCatalogResource } from "@/lib/organization-catalog-cache";
import {
  CatalogLifecycleError,
  catalogModerationTransitionTarget,
  catalogTransitionTarget,
} from "@/lib/organization-catalog-lifecycle";
import {
  type CatalogKind,
  requireCatalogPublisher,
} from "@/lib/organization-catalog-permissions";
import {
  publicOrganizationProductWhere,
  publicOrganizationServiceWhere,
} from "@/lib/organization-catalog-visibility";
import { prisma } from "@/lib/prisma";
import { requireOrganizationPermission } from "@/lib/organization-permissions";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";
import { captureServerProductEvent } from "@/lib/product-analytics-server";

export class OrganizationCatalogError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "OrganizationCatalogError";
  }
}

export type CatalogTransitionAction =
  | "SUBMIT"
  | "PUBLISH"
  | "PAUSE"
  | "RESUME"
  | "OUT_OF_STOCK"
  | "UNAVAILABLE"
  | "ARCHIVE";

const organizationSelect = {
  id: true,
  slug: true,
  publicName: true,
  lifecycleStatus: true,
  publicProfileStatus: true,
  publicProfileBlockedAt: true,
  verificationStatus: true,
  isOfficialPartner: true,
  logoMediaId: true,
  city: { select: { id: true, slug: true, name: true } },
} satisfies Prisma.OrganizationSelect;

const productPublicSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  category: true,
  status: true,
  priceType: true,
  priceMinor: true,
  currency: true,
  availabilityLabel: true,
  locationLabel: true,
  contactMethod: true,
  externalUrl: true,
  externalUrlBlockedAt: true,
  publishedAt: true,
  organization: { select: organizationSelect },
  city: { select: { id: true, slug: true, name: true } },
  media: {
    where: { media: { status: "ACTIVE", scanStatus: "CLEAN" } },
    select: {
      id: true,
      mediaId: true,
      kind: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 8,
  },
} satisfies Prisma.OrganizationProductSelect;

const servicePublicSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  description: true,
  category: true,
  status: true,
  priceType: true,
  priceMinor: true,
  currency: true,
  availabilityLabel: true,
  deliveryMode: true,
  locationLabel: true,
  contactMethod: true,
  externalUrl: true,
  externalUrlBlockedAt: true,
  publishedAt: true,
  organization: { select: organizationSelect },
  city: { select: { id: true, slug: true, name: true } },
  media: {
    where: { media: { status: "ACTIVE", scanStatus: "CLEAN" } },
    select: {
      id: true,
      mediaId: true,
      kind: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    take: 8,
  },
} satisfies Prisma.OrganizationServiceSelect;

type ProductPublicRecord = Prisma.OrganizationProductGetPayload<{
  select: typeof productPublicSelect;
}>;
type ServicePublicRecord = Prisma.OrganizationServiceGetPayload<{
  select: typeof servicePublicSelect;
}>;

function publicHref(kind: CatalogKind, slug: string) {
  return `/${kind === "product" ? "products" : "services"}/${slug}`;
}

function formatPrice(
  priceType: OrganizationCatalogPriceType,
  amount: number | null,
  currency: string,
) {
  if (priceType === "FREE") return "Free";
  if (priceType === "CONTACT" || amount === null) return "Contact for price";
  const formatted = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
  return priceType === "STARTING_AT" ? `From ${formatted}` : formatted;
}

function serializeCatalogRecord(
  kind: CatalogKind,
  row: ProductPublicRecord | ServicePublicRecord,
) {
  const service = kind === "service" ? (row as ServicePublicRecord) : null;
  return {
    kind,
    id: row.id,
    slug: row.slug,
    href: publicHref(kind, row.slug),
    title: row.title,
    shortDescription: row.shortDescription,
    description: row.description,
    category: row.category,
    status: row.status,
    priceType: row.priceType,
    priceMinor: row.priceMinor,
    currency: row.currency,
    priceLabel: formatPrice(row.priceType, row.priceMinor, row.currency),
    availabilityLabel: row.availabilityLabel,
    deliveryMode: service?.deliveryMode ?? null,
    locationLabel: row.locationLabel,
    contactMethod:
      row.contactMethod === "EXTERNAL_URL" && row.externalUrlBlockedAt
        ? "PUBLIC_CONTACT"
        : row.contactMethod,
    externalUrl: row.externalUrlBlockedAt ? null : row.externalUrl,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    organization: {
      id: row.organization.id,
      slug: row.organization.slug,
      name: row.organization.publicName,
      verified: row.organization.verificationStatus === "VERIFIED",
      partner: row.organization.isOfficialPartner,
      logoUrl: row.organization.logoMediaId
        ? `/api/media/${row.organization.logoMediaId}`
        : null,
    },
    city: row.city ?? row.organization.city,
    media: row.media.map((item) => ({
      id: item.id,
      url: `/api/media/${item.mediaId}`,
      altText: item.altText,
      cover: item.kind === "COVER",
    })),
  };
}

export type PublicCatalogItem = ReturnType<typeof serializeCatalogRecord>;

async function uniqueSlug(kind: CatalogKind, title: string) {
  const base =
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || kind;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt ? `${base}-${attempt + 1}` : base;
    const found =
      kind === "product"
        ? await prisma.organizationProduct.findUnique({
            where: { slug: candidate },
            select: { id: true },
          })
        : await prisma.organizationService.findUnique({
            where: { slug: candidate },
            select: { id: true },
          });
    if (!found) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function resourceData(input: CatalogResourceInput, kind: CatalogKind) {
  return {
    title: input.title || `Untitled ${kind}`,
    shortDescription: input.shortDescription,
    description: input.description,
    category: input.category || "General",
    cityId: input.cityId ?? null,
    priceType: input.priceType,
    priceMinor:
      input.priceType === "FIXED" || input.priceType === "STARTING_AT"
        ? (input.priceMinor ?? null)
        : null,
    currency: input.currency,
    availabilityLabel: input.availabilityLabel,
    locationLabel: input.locationLabel,
    contactMethod: input.contactMethod,
    externalUrl: input.externalUrl ?? null,
    ...(kind === "service" ? { deliveryMode: input.deliveryMode } : {}),
  };
}

export async function createOrganizationCatalogResource(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
  data: CatalogResourceInput;
}) {
  const context = await requireCatalogPublisher({
    ...input,
    action: "create",
  });
  const slug = await uniqueSlug(input.kind, input.data.title);
  const data = {
    ...resourceData(input.data, input.kind),
    slug,
    organizationId: input.organizationId,
    createdByUserId: input.userId,
  };
  const created =
    input.kind === "product"
      ? await prisma.organizationProduct.create({
          data,
          select: { id: true, slug: true },
        })
      : await prisma.organizationService.create({
          data,
          select: { id: true, slug: true },
        });
  await Promise.all([
    writeAuditLog({
      actorId: input.userId,
      organizationId: input.organizationId,
      action: `ORGANIZATION_${input.kind.toUpperCase()}_CREATED`,
      entityType:
        input.kind === "product"
          ? "OrganizationProduct"
          : "OrganizationService",
      entityId: created.id,
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event:
        input.kind === "product"
          ? PRODUCT_EVENTS.ORGANIZATION_PRODUCT_CREATED
          : PRODUCT_EVENTS.ORGANIZATION_SERVICE_CREATED,
      properties: { category: input.data.category || "General" },
    }),
  ]);
  revalidateCatalogResource({
    kind: input.kind,
    slug: created.slug,
    organizationSlug: context.organization.slug,
  });
  return created;
}

async function ownedCatalogRecord(input: {
  kind: CatalogKind;
  organizationId: string;
  resourceId: string;
}) {
  const select = {
    id: true,
    slug: true,
    title: true,
    status: true,
    externalUrl: true,
    externalUrlBlockedAt: true,
    version: true,
    organizationId: true,
    organization: { select: { slug: true } },
    city: { select: { slug: true } },
  } as const;
  const record =
    input.kind === "product"
      ? await prisma.organizationProduct.findFirst({
          where: { id: input.resourceId, organizationId: input.organizationId },
          select,
        })
      : await prisma.organizationService.findFirst({
          where: { id: input.resourceId, organizationId: input.organizationId },
          select,
        });
  if (!record)
    throw new OrganizationCatalogError("Catalog item not found.", 404);
  return record;
}

export async function updateOrganizationCatalogResource(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
  resourceId: string;
  data: CatalogResourceInput;
}) {
  const existing = await ownedCatalogRecord(input);
  const context = await requireCatalogPublisher({ ...input, action: "edit" });
  if (["REMOVED", "ARCHIVED"].includes(existing.status)) {
    throw new OrganizationCatalogError(
      "This catalog item can no longer be edited.",
      409,
    );
  }
  if (input.data.version && input.data.version !== existing.version) {
    throw new OrganizationCatalogError(
      "This item changed in another session. Refresh before saving again.",
      409,
    );
  }
  const data = {
    ...resourceData(input.data, input.kind),
    version: { increment: 1 },
  };
  const updated =
    input.kind === "product"
      ? await prisma.organizationProduct.update({
          where: { id: existing.id },
          data,
          select: { id: true, slug: true, version: true },
        })
      : await prisma.organizationService.update({
          where: { id: existing.id },
          data,
          select: { id: true, slug: true, version: true },
        });
  await writeAuditLog({
    actorId: input.userId,
    organizationId: input.organizationId,
    action: `ORGANIZATION_${input.kind.toUpperCase()}_UPDATED`,
    entityType:
      input.kind === "product" ? "OrganizationProduct" : "OrganizationService",
    entityId: existing.id,
  });
  revalidateCatalogResource({
    kind: input.kind,
    slug: existing.slug,
    organizationSlug: context.organization.slug,
    citySlug: existing.city?.slug,
  });
  return updated;
}

function assertPublishReady(input: {
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  priceType: OrganizationCatalogPriceType;
  priceMinor: number | null;
  contactMethod: string;
  externalUrl: string | null;
}) {
  const missing = [
    input.title.trim().length >= 3 ? null : "title",
    input.shortDescription.trim().length >= 20 ? null : "short description",
    input.description.trim().length >= 40 ? null : "description",
    input.category.trim().length >= 2 ? null : "category",
    (input.priceType !== "FIXED" && input.priceType !== "STARTING_AT") ||
    input.priceMinor !== null
      ? null
      : "price",
    input.contactMethod !== "EXTERNAL_URL" || input.externalUrl
      ? null
      : "external link",
  ].filter(Boolean);
  if (missing.length) {
    throw new OrganizationCatalogError(
      `Complete the ${missing.join(", ")} before submitting.`,
      400,
    );
  }
}

export async function transitionOrganizationCatalogResource(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
  resourceId: string;
  action: CatalogTransitionAction;
}) {
  const existing = await ownedCatalogRecord(input);
  const permission =
    input.action === "ARCHIVE"
      ? "archive"
      : input.action === "SUBMIT"
        ? "edit"
        : "publish";
  const context = await requireCatalogPublisher({
    ...input,
    action: permission,
    requiresPublishing: ["SUBMIT", "PUBLISH", "RESUME"].includes(input.action),
  });
  const full =
    input.kind === "product"
      ? await prisma.organizationProduct.findUniqueOrThrow({
          where: { id: existing.id },
          select: {
            title: true,
            shortDescription: true,
            description: true,
            category: true,
            priceType: true,
            priceMinor: true,
            contactMethod: true,
            externalUrl: true,
          },
        })
      : await prisma.organizationService.findUniqueOrThrow({
          where: { id: existing.id },
          select: {
            title: true,
            shortDescription: true,
            description: true,
            category: true,
            priceType: true,
            priceMinor: true,
            contactMethod: true,
            externalUrl: true,
          },
        });
  if (input.action === "SUBMIT" || input.action === "PUBLISH") {
    assertPublishReady(full);
  }
  let target: OrganizationProductStatus | OrganizationServiceStatus;
  try {
    target = catalogTransitionTarget(
      input.kind === "product"
        ? {
            kind: "product",
            from: existing.status as OrganizationProductStatus,
            action: input.action,
          }
        : {
            kind: "service",
            from: existing.status as OrganizationServiceStatus,
            action: input.action,
          },
    );
  } catch (error) {
    if (error instanceof CatalogLifecycleError) {
      throw new OrganizationCatalogError(error.message, error.status);
    }
    throw error;
  }
  const now = new Date();
  const data = {
    status: target as never,
    submittedAt: target === "PENDING_REVIEW" ? now : undefined,
    publishedAt: target === "PUBLISHED" ? now : undefined,
    pausedAt: target === "PAUSED" ? now : undefined,
    archivedAt: target === "ARCHIVED" ? now : undefined,
    ...(input.kind === "product" && target === "OUT_OF_STOCK"
      ? { outOfStockAt: now }
      : {}),
    ...(input.kind === "service" && target === "UNAVAILABLE"
      ? { unavailableAt: now }
      : {}),
    version: { increment: 1 },
  };
  if (input.kind === "product") {
    await prisma.organizationProduct.update({
      where: { id: existing.id },
      data,
    });
  } else {
    await prisma.organizationService.update({
      where: { id: existing.id },
      data,
    });
  }
  await Promise.all([
    writeAuditLog({
      actorId: input.userId,
      organizationId: input.organizationId,
      action: `ORGANIZATION_${input.kind.toUpperCase()}_${input.action}`,
      entityType:
        input.kind === "product"
          ? "OrganizationProduct"
          : "OrganizationService",
      entityId: existing.id,
      oldValue: { status: existing.status },
      newValue: { status: target },
    }),
    captureServerProductEvent({
      distinctId: input.userId,
      event:
        input.kind === "product"
          ? PRODUCT_EVENTS.ORGANIZATION_PRODUCT_LIFECYCLE_CHANGED
          : PRODUCT_EVENTS.ORGANIZATION_SERVICE_LIFECYCLE_CHANGED,
      properties: { action: input.action, target_status: target },
    }),
  ]);
  revalidateCatalogResource({
    kind: input.kind,
    slug: existing.slug,
    organizationSlug: context.organization.slug,
    citySlug: existing.city?.slug,
  });
  return { status: target };
}

export async function listPublicCatalog(input: {
  kind: CatalogKind;
  query?: string;
  cityId?: string;
  organizationId?: string;
  category?: string;
  limit?: number;
}) {
  const take = Math.min(60, Math.max(1, input.limit ?? 24));
  const query = input.query?.trim().slice(0, 100);
  const common = {
    cityId: input.cityId,
    organizationId: input.organizationId,
    category: input.category,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" as const } },
            {
              shortDescription: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            { category: { contains: query, mode: "insensitive" as const } },
            {
              organization: {
                publicName: { contains: query, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
  };
  if (input.kind === "product") {
    const rows = await prisma.organizationProduct.findMany({
      where: { AND: [publicOrganizationProductWhere, common] },
      select: productPublicSelect,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      take,
    });
    return rows.map((row) => serializeCatalogRecord("product", row));
  }
  const rows = await prisma.organizationService.findMany({
    where: { AND: [publicOrganizationServiceWhere, common] },
    select: servicePublicSelect,
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take,
  });
  return rows.map((row) => serializeCatalogRecord("service", row));
}

export async function getPublicCatalogResource(
  kind: CatalogKind,
  slug: string,
) {
  if (kind === "product") {
    const row = await prisma.organizationProduct.findFirst({
      where: { slug, ...publicOrganizationProductWhere },
      select: productPublicSelect,
    });
    return row ? serializeCatalogRecord("product", row) : null;
  }
  const row = await prisma.organizationService.findFirst({
    where: { slug, ...publicOrganizationServiceWhere },
    select: servicePublicSelect,
  });
  return row ? serializeCatalogRecord("service", row) : null;
}

export async function listOrganizationCatalog(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
}) {
  await requireOrganizationPermission(
    input.userId,
    { id: input.organizationId },
    "ORGANIZATION_VIEW_CATALOG",
  );
  const select = {
    id: true,
    slug: true,
    title: true,
    category: true,
    status: true,
    priceType: true,
    priceMinor: true,
    currency: true,
    updatedAt: true,
    _count: { select: { inquiries: true } },
  } as const;
  const rows =
    input.kind === "product"
      ? await prisma.organizationProduct.findMany({
          where: { organizationId: input.organizationId },
          select,
          orderBy: { updatedAt: "desc" },
        })
      : await prisma.organizationService.findMany({
          where: { organizationId: input.organizationId },
          select,
          orderBy: { updatedAt: "desc" },
        });
  return rows.map((row) => ({
    ...row,
    priceLabel: formatPrice(row.priceType, row.priceMinor, row.currency),
  }));
}

export async function getCatalogResourceForEdit(input: {
  kind: CatalogKind;
  userId: string;
  organizationId: string;
  resourceId: string;
}) {
  const existing = await ownedCatalogRecord(input);
  await requireCatalogPublisher({ ...input, action: "edit" });
  const select = {
    id: true,
    slug: true,
    title: true,
    shortDescription: true,
    description: true,
    category: true,
    status: true,
    cityId: true,
    priceType: true,
    priceMinor: true,
    currency: true,
    availabilityLabel: true,
    locationLabel: true,
    contactMethod: true,
    externalUrl: true,
    version: true,
    media: {
      select: {
        id: true,
        mediaId: true,
        kind: true,
        altText: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" as const },
    },
  } as const;
  return input.kind === "product"
    ? prisma.organizationProduct.findUniqueOrThrow({
        where: { id: existing.id },
        select,
      })
    : prisma.organizationService.findUniqueOrThrow({
        where: { id: existing.id },
        select: { ...select, deliveryMode: true },
      });
}

export async function toggleCatalogSaved(input: {
  kind: CatalogKind;
  userId: string;
  resourceId: string;
}) {
  const publicRecord =
    input.kind === "product"
      ? await prisma.organizationProduct.findFirst({
          where: { id: input.resourceId, ...publicOrganizationProductWhere },
          select: {
            id: true,
            slug: true,
            organization: { select: { slug: true } },
            city: { select: { slug: true } },
          },
        })
      : await prisma.organizationService.findFirst({
          where: { id: input.resourceId, ...publicOrganizationServiceWhere },
          select: {
            id: true,
            slug: true,
            organization: { select: { slug: true } },
            city: { select: { slug: true } },
          },
        });
  if (!publicRecord)
    throw new OrganizationCatalogError("Catalog item not found.", 404);
  if (input.kind === "product") {
    const existing = await prisma.organizationProductSaved.findUnique({
      where: {
        userId_productId: { userId: input.userId, productId: input.resourceId },
      },
    });
    if (existing) {
      await prisma.organizationProductSaved.delete({
        where: {
          userId_productId: {
            userId: input.userId,
            productId: input.resourceId,
          },
        },
      });
    } else {
      await prisma.organizationProductSaved.create({
        data: { userId: input.userId, productId: input.resourceId },
      });
    }
    await captureServerProductEvent({
      distinctId: input.userId,
      event: PRODUCT_EVENTS.ORGANIZATION_PRODUCT_SAVED,
      properties: { saved: !existing },
    });
    return { saved: !existing };
  }
  const existing = await prisma.organizationServiceSaved.findUnique({
    where: {
      userId_serviceId: { userId: input.userId, serviceId: input.resourceId },
    },
  });
  if (existing) {
    await prisma.organizationServiceSaved.delete({
      where: {
        userId_serviceId: { userId: input.userId, serviceId: input.resourceId },
      },
    });
  } else {
    await prisma.organizationServiceSaved.create({
      data: { userId: input.userId, serviceId: input.resourceId },
    });
  }
  await captureServerProductEvent({
    distinctId: input.userId,
    event: PRODUCT_EVENTS.ORGANIZATION_SERVICE_SAVED,
    properties: { saved: !existing },
  });
  return { saved: !existing };
}

export async function isCatalogSaved(input: {
  kind: CatalogKind;
  userId: string;
  resourceId: string;
}) {
  const saved =
    input.kind === "product"
      ? await prisma.organizationProductSaved.findUnique({
          where: {
            userId_productId: {
              userId: input.userId,
              productId: input.resourceId,
            },
          },
          select: { createdAt: true },
        })
      : await prisma.organizationServiceSaved.findUnique({
          where: {
            userId_serviceId: {
              userId: input.userId,
              serviceId: input.resourceId,
            },
          },
          select: { createdAt: true },
        });
  return Boolean(saved);
}

export async function listSavedCatalog(userId: string) {
  const [products, services] = await Promise.all([
    prisma.organizationProductSaved.findMany({
      where: { userId, product: publicOrganizationProductWhere },
      select: { createdAt: true, product: { select: productPublicSelect } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.organizationServiceSaved.findMany({
      where: { userId, service: publicOrganizationServiceWhere },
      select: { createdAt: true, service: { select: servicePublicSelect } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return {
    products: products.map(({ product, createdAt }) => ({
      ...serializeCatalogRecord("product", product),
      savedAt: createdAt.toISOString(),
    })),
    services: services.map(({ service, createdAt }) => ({
      ...serializeCatalogRecord("service", service),
      savedAt: createdAt.toISOString(),
    })),
  };
}

export async function createCatalogInquiry(input: {
  kind: CatalogKind;
  userId: string;
  resourceId: string;
  message: string;
  topic: string;
  clientMessageId?: string;
}) {
  const record =
    input.kind === "product"
      ? await prisma.organizationProduct.findFirst({
          where: { id: input.resourceId, ...publicOrganizationProductWhere },
          select: {
            id: true,
            title: true,
            organizationId: true,
            contactMethod: true,
            organization: {
              select: {
                memberships: {
                  where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
                  select: { userId: true, role: true },
                  orderBy: { joinedAt: "asc" },
                  take: 1,
                },
              },
            },
          },
        })
      : await prisma.organizationService.findFirst({
          where: { id: input.resourceId, ...publicOrganizationServiceWhere },
          select: {
            id: true,
            title: true,
            organizationId: true,
            contactMethod: true,
            organization: {
              select: {
                memberships: {
                  where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
                  select: { userId: true, role: true },
                  orderBy: { joinedAt: "asc" },
                  take: 1,
                },
              },
            },
          },
        });
  if (!record)
    throw new OrganizationCatalogError("Catalog item not found.", 404);
  if (record.contactMethod !== "KONDO_MESSAGE") {
    throw new OrganizationCatalogError(
      "This item uses a different contact method.",
      409,
    );
  }
  const recipientId = record.organization.memberships[0]?.userId;
  if (!recipientId) {
    throw new OrganizationCatalogError(
      "This organization is not available for messages.",
      409,
    );
  }
  const message = await createDirectMessage({
    senderId: input.userId,
    recipientId,
    body: input.message,
    clientMessageId: input.clientMessageId,
    sourceType:
      input.kind === "product"
        ? "ORGANIZATION_PRODUCT"
        : "ORGANIZATION_SERVICE",
    sourceId: input.resourceId,
  });
  if (input.kind === "product") {
    await prisma.organizationProductInquiry.upsert({
      where: {
        productId_requesterUserId: {
          productId: input.resourceId,
          requesterUserId: input.userId,
        },
      },
      create: {
        productId: input.resourceId,
        organizationId: record.organizationId,
        requesterUserId: input.userId,
        recipientUserId: recipientId,
        conversationId: message.conversationId,
        topic: input.topic,
      },
      update: {
        conversationId: message.conversationId,
        topic: input.topic,
        status: "OPEN",
      },
    });
  } else {
    await prisma.organizationServiceInquiry.upsert({
      where: {
        serviceId_requesterUserId: {
          serviceId: input.resourceId,
          requesterUserId: input.userId,
        },
      },
      create: {
        serviceId: input.resourceId,
        organizationId: record.organizationId,
        requesterUserId: input.userId,
        recipientUserId: recipientId,
        conversationId: message.conversationId,
        topic: input.topic,
      },
      update: {
        conversationId: message.conversationId,
        topic: input.topic,
        status: "OPEN",
      },
    });
  }
  await captureServerProductEvent({
    distinctId: input.userId,
    event:
      input.kind === "product"
        ? PRODUCT_EVENTS.ORGANIZATION_PRODUCT_INQUIRY_SENT
        : PRODUCT_EVENTS.ORGANIZATION_SERVICE_INQUIRY_SENT,
    properties: { contact_method: "KONDO_MESSAGE" },
  });
  return message;
}

const reportReasonMap = {
  SCAM: "SCAM",
  MISLEADING_PRICE: "SCAM",
  COUNTERFEIT_OR_PROHIBITED_PRODUCT: "INAPPROPRIATE",
  MISLEADING_SERVICE_CLAIM: "SCAM",
  UNSAFE_EXTERNAL_LINK: "SCAM",
  UNAUTHORIZED_FEE: "SCAM",
  FALSE_GUARANTEE: "SCAM",
  IMPERSONATION: "SCAM",
  STOLEN_MEDIA: "INAPPROPRIATE",
  OTHER: "OTHER",
} as const;

export async function reportCatalogResource(input: {
  kind: CatalogKind;
  userId: string;
  resourceId: string;
  reason: keyof typeof reportReasonMap;
  details?: string;
}) {
  const exists =
    input.kind === "product"
      ? await prisma.organizationProduct.findFirst({
          where: { id: input.resourceId, ...publicOrganizationProductWhere },
          select: { id: true },
        })
      : await prisma.organizationService.findFirst({
          where: { id: input.resourceId, ...publicOrganizationServiceWhere },
          select: { id: true },
        });
  if (!exists)
    throw new OrganizationCatalogError("Catalog item not found.", 404);
  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: input.userId,
      targetType:
        input.kind === "product"
          ? "OrganizationProduct"
          : "OrganizationService",
      targetId: input.resourceId,
      status: { in: ["OPEN", "REVIEWING"] },
    },
    select: { id: true },
  });
  if (duplicate) return { id: duplicate.id, deduplicated: true };
  const report = await prisma.report.create({
    data: {
      reporterId: input.userId,
      targetType:
        input.kind === "product"
          ? "OrganizationProduct"
          : "OrganizationService",
      targetId: input.resourceId,
      reason: reportReasonMap[input.reason],
      details: `[${input.reason}]${input.details ? ` ${input.details}` : ""}`,
    },
    select: { id: true },
  });
  return { id: report.id, deduplicated: false };
}

export async function moderateCatalogResource(input: {
  kind: CatalogKind;
  resourceId: string;
  adminUserId: string;
  action: "REMOVE" | "RESTORE_FOR_REVIEW" | "BLOCK_EXTERNAL_URL";
  note?: string | null;
}) {
  const note = input.note?.trim().slice(0, 2000) ?? "";
  if (note.length < 10) {
    throw new OrganizationCatalogError(
      "Add an internal moderation note with at least 10 characters.",
      400,
    );
  }
  const existing = await ownedCatalogRecord({
    kind: input.kind,
    organizationId:
      input.kind === "product"
        ? ((
            await prisma.organizationProduct.findUnique({
              where: { id: input.resourceId },
              select: { organizationId: true },
            })
          )?.organizationId ?? "")
        : ((
            await prisma.organizationService.findUnique({
              where: { id: input.resourceId },
              select: { organizationId: true },
            })
          )?.organizationId ?? ""),
    resourceId: input.resourceId,
  });
  const now = new Date();
  if (input.action === "BLOCK_EXTERNAL_URL") {
    if (!existing.externalUrl) {
      throw new OrganizationCatalogError(
        "This catalog item has no external URL to block.",
        409,
      );
    }
    if (existing.externalUrlBlockedAt) {
      throw new OrganizationCatalogError(
        "This external URL is already blocked.",
        409,
      );
    }
  } else {
    try {
      catalogModerationTransitionTarget({
        kind: input.kind,
        from: existing.status,
        action: input.action,
      });
    } catch (error) {
      if (error instanceof CatalogLifecycleError) {
        throw new OrganizationCatalogError(error.message, error.status);
      }
      throw error;
    }
  }
  const data =
    input.action === "REMOVE"
      ? {
          status: "REMOVED" as const,
          publicationBlockedAt: now,
          removedAt: now,
          moderationNote: note,
          version: { increment: 1 },
        }
      : input.action === "RESTORE_FOR_REVIEW"
        ? {
            status: "PENDING_REVIEW" as const,
            publicationBlockedAt: null,
            removedAt: null,
            moderationNote: note,
            version: { increment: 1 },
          }
        : {
            externalUrlBlockedAt: now,
            moderationNote: note,
            version: { increment: 1 },
          };
  await prisma.$transaction(async (tx) => {
    if (input.kind === "product") {
      await tx.organizationProduct.update({
        where: { id: input.resourceId },
        data,
      });
    } else {
      await tx.organizationService.update({
        where: { id: input.resourceId },
        data,
      });
    }
    const organization = await tx.organization.findUnique({
      where: { id: existing.organizationId },
      select: {
        publicName: true,
        memberships: {
          where: { status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] } },
          select: { userId: true },
        },
      },
    });
    for (const membership of organization?.memberships ?? []) {
      await enqueueNotificationJobWithClient(tx, {
        recipientId: membership.userId,
        actorId: input.adminUserId,
        type: "MODERATION_UPDATE",
        templateKey: "ORGANIZATION_STATUS_UPDATE",
        data: {
          organizationName: organization?.publicName ?? "Your organization",
          outcome: `${input.kind} moderation: ${input.action.toLowerCase().replaceAll("_", " ")}.`,
        },
        href: `/organizations/${existing.organization.slug}/catalog/${input.kind === "product" ? "products" : "services"}/${input.resourceId}`,
        dedupeKey: `catalog-moderation:${input.kind}:${input.resourceId}:${input.action}:${now.toISOString()}:${membership.userId}`,
      });
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.adminUserId,
      organizationId: existing.organizationId,
      action: `ORGANIZATION_${input.kind.toUpperCase()}_MODERATION_${input.action}`,
      entityType:
        input.kind === "product"
          ? "OrganizationProduct"
          : "OrganizationService",
      entityId: input.resourceId,
      oldValue: {
        status: existing.status,
        externalUrlBlocked: Boolean(existing.externalUrlBlockedAt),
      },
      newValue: { action: input.action },
    });
  });
  revalidateCatalogResource({
    kind: input.kind,
    slug: existing.slug,
    organizationSlug: existing.organization.slug,
    citySlug: existing.city?.slug,
  });
  return { action: input.action };
}

export async function getOrganizationCatalogProjection(
  kind: CatalogKind,
  organizationId: string,
) {
  const items = await listPublicCatalog({ kind, organizationId, limit: 4 });
  const total =
    kind === "product"
      ? await prisma.organizationProduct.count({
          where: { organizationId, ...publicOrganizationProductWhere },
        })
      : await prisma.organizationService.count({
          where: { organizationId, ...publicOrganizationServiceWhere },
        });
  return {
    available: total > 0,
    itemCount: total,
    featuredItems: items.map((item) => ({
      id: item.id,
      title: item.title,
      href: item.href,
      context: `${item.priceLabel}${item.availabilityLabel ? ` · ${item.availabilityLabel}` : ""}`,
    })),
    sectionRoute: total
      ? `/discover?type=${kind === "product" ? "products" : "services"}&organizationId=${organizationId}`
      : null,
    visibility: total ? ("PUBLIC" as const) : ("HIDDEN" as const),
  };
}
