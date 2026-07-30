import { randomUUID } from "node:crypto";
import { Prisma, type OrganizationCapabilityKey } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import {
  canDeleteOrArchiveOrganization,
  canEditOrganization,
  canViewOrganizationDraft,
} from "@/lib/organization-authorization";
import { attachMediaAsset, MediaError } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import { captureServerProductEvent } from "@/lib/product-analytics-server";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

type Actor = { id: string; role: string };
type RequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type OrganizationDraftInput = {
  publicName: string;
  type:
    | "COMPANY"
    | "UNIVERSITY"
    | "EDUCATION_AGENCY"
    | "HOUSING_PROVIDER"
    | "STUDENT_ASSOCIATION"
    | "EMBASSY_OR_CONSULATE"
    | "RECRUITMENT_ORGANIZATION"
    | "SERVICE_PROVIDER"
    | "OTHER";
  countryId: string;
  cityId?: string;
};

type OrganizationUpdateInput = Partial<OrganizationDraftInput> & {
  legalName?: string;
  shortDescription?: string;
  website?: string;
  professionalEmail?: string;
  professionalPhone?: string;
  logoMediaId?: string;
  capabilities?: OrganizationCapabilityKey[];
  setupStep?: number;
};

export class OrganizationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OrganizationError";
  }
}

const organizationSetupSelect = {
  id: true,
  publicName: true,
  legalName: true,
  slug: true,
  type: true,
  shortDescription: true,
  countryId: true,
  cityId: true,
  website: true,
  professionalEmail: true,
  professionalPhone: true,
  logoMediaId: true,
  lifecycleStatus: true,
  verificationStatus: true,
  setupStep: true,
  setupCompletedAt: true,
  createdAt: true,
  updatedAt: true,
  country: { select: { id: true, code: true, name: true, emoji: true } },
  city: { select: { id: true, name: true, province: true } },
  capabilities: {
    where: { status: "ENABLED" as const },
    select: { key: true, status: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.OrganizationSelect;

function slugBase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function organizationSlug(name: string) {
  return `${slugBase(name) || "organization"}-${randomUUID().slice(0, 6)}`;
}

async function validateLocation(
  client: Pick<Prisma.TransactionClient, "country" | "city">,
  input: { countryId: string; cityId?: string | null },
) {
  const country = await client.country.findFirst({
    where: { id: input.countryId, isActive: true },
    select: { id: true },
  });
  if (!country) throw new OrganizationError("Select an active country.");
  if (input.cityId) {
    const city = await client.city.findFirst({
      where: {
        id: input.cityId,
        countryId: country.id,
        isActive: true,
      },
      select: { id: true },
    });
    if (!city) {
      throw new OrganizationError(
        "Select an active city in the chosen country.",
      );
    }
  }
}

function safeOrganizationDto<
  T extends Prisma.OrganizationGetPayload<{
    select: typeof organizationSetupSelect;
  }>,
>(organization: T) {
  return {
    ...organization,
    setupCompletedAt: organization.setupCompletedAt?.toISOString() ?? null,
    createdAt: organization.createdAt.toISOString(),
    updatedAt: organization.updatedAt.toISOString(),
    capabilities: organization.capabilities.map(({ key }) => key),
  };
}

async function membershipFor(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string,
) {
  return tx.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { role: true, status: true },
  });
}

export async function createOrganizationDraft(
  actor: Actor,
  input: OrganizationDraftInput,
  meta: RequestMeta = {},
) {
  const organization = await prisma.$transaction(
    async (tx) => {
      await validateLocation(tx, input);
      const created = await tx.organization.create({
        data: {
          publicName: input.publicName,
          slug: organizationSlug(input.publicName),
          type: input.type,
          countryId: input.countryId,
          cityId: input.cityId ?? null,
          lifecycleStatus: "DRAFT",
          verificationStatus: "NOT_SUBMITTED",
          setupStep: 2,
          createdById: actor.id,
          memberships: {
            create: {
              userId: actor.id,
              role: "OWNER",
              status: "ACTIVE",
            },
          },
        },
        select: organizationSetupSelect,
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId: created.id,
        action: "ORGANIZATION_CREATED",
        entityType: "Organization",
        entityId: created.id,
        newValue: {
          type: created.type,
          lifecycleStatus: created.lifecycleStatus,
          countryId: created.countryId,
          cityId: created.cityId,
        },
        ...meta,
      });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        organizationId: created.id,
        action: "ORGANIZATION_OWNERSHIP_ESTABLISHED",
        entityType: "OrganizationMembership",
        entityId: `${created.id}:${actor.id}`,
        newValue: { organizationId: created.id, role: "OWNER" },
        ...meta,
      });
      return created;
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
  );
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_DRAFT_CREATED,
    properties: { organization_type: organization.type },
  });
  return safeOrganizationDto(organization);
}

async function updateOrganizationWithClient(
  tx: Prisma.TransactionClient,
  actor: Actor,
  organizationId: string,
  input: OrganizationUpdateInput,
  meta: RequestMeta,
) {
  const current = await tx.organization.findUnique({
    where: { id: organizationId },
    select: {
      ...organizationSetupSelect,
      memberships: {
        where: { userId: actor.id },
        select: { role: true, status: true },
        take: 1,
      },
    },
  });
  if (!current) throw new OrganizationError("Organization not found.", 404);
  const membership = current.memberships[0] ?? null;
  if (!canEditOrganization(membership)) {
    throw new OrganizationError(
      "You do not have permission to edit this organization.",
      403,
    );
  }
  if (current.lifecycleStatus === "ARCHIVED") {
    throw new OrganizationError(
      "Archived organizations cannot be edited.",
      409,
    );
  }

  const nextCountryId = input.countryId ?? current.countryId;
  const nextCityId =
    input.cityId === undefined ? current.cityId : input.cityId || null;
  if (input.countryId !== undefined || input.cityId !== undefined) {
    await validateLocation(tx, {
      countryId: nextCountryId,
      cityId: nextCityId,
    });
  }

  if (input.logoMediaId && input.logoMediaId !== current.logoMediaId) {
    await attachMediaAsset(tx, {
      ownerId: actor.id,
      assetId: input.logoMediaId,
      purpose: "ORGANIZATION_LOGO",
      attachmentType: "ORGANIZATION_LOGO",
      attachmentId: current.id,
    });
    if (current.logoMediaId) {
      await tx.mediaAsset.updateMany({
        where: {
          id: current.logoMediaId,
          attachmentType: "ORGANIZATION_LOGO",
          attachmentId: current.id,
        },
        data: {
          attachedAt: null,
          attachmentType: null,
          attachmentId: null,
        },
      });
    }
  }

  if (input.capabilities) {
    const selected = new Set(input.capabilities);
    for (const key of input.capabilities) {
      await tx.organizationCapability.upsert({
        where: { organizationId_key: { organizationId, key } },
        create: { organizationId, key, status: "ENABLED" },
        update: { status: "ENABLED" },
      });
    }
    await tx.organizationCapability.updateMany({
      where: {
        organizationId,
        key: { notIn: [...selected] },
      },
      data: { status: "DISABLED" },
    });
  }

  const updated = await tx.organization.update({
    where: { id: organizationId },
    data: {
      publicName: input.publicName,
      legalName: input.legalName,
      type: input.type,
      countryId: input.countryId,
      cityId: input.cityId === undefined ? undefined : input.cityId || null,
      shortDescription: input.shortDescription,
      website: input.website,
      professionalEmail: input.professionalEmail,
      professionalPhone: input.professionalPhone,
      logoMediaId: input.logoMediaId,
      setupStep: input.setupStep,
    },
    select: organizationSetupSelect,
  });
  await writeAuditLogWithClient(tx, {
    actorId: actor.id,
    organizationId,
    action: "ORGANIZATION_DRAFT_UPDATED",
    entityType: "Organization",
    entityId: organizationId,
    oldValue: {
      type: current.type,
      countryId: current.countryId,
      cityId: current.cityId,
      setupStep: current.setupStep,
    },
    newValue: {
      type: updated.type,
      countryId: updated.countryId,
      cityId: updated.cityId,
      setupStep: updated.setupStep,
      capabilityCount: updated.capabilities.length,
    },
    ...meta,
  });
  return updated;
}

export async function updateOrganizationDraft(
  actor: Actor,
  organizationId: string,
  input: OrganizationUpdateInput,
  meta: RequestMeta = {},
) {
  try {
    const updated = await prisma.$transaction((tx) =>
      updateOrganizationWithClient(tx, actor, organizationId, input, meta),
    );
    return safeOrganizationDto(updated);
  } catch (error) {
    if (error instanceof MediaError) {
      throw new OrganizationError(error.message, error.status);
    }
    throw error;
  }
}

export async function completeOrganizationOnboarding(
  actor: Actor,
  organizationId: string,
  input: OrganizationUpdateInput,
  meta: RequestMeta = {},
) {
  const completed = await prisma.$transaction(async (tx) => {
    await updateOrganizationWithClient(tx, actor, organizationId, input, meta);
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: {
        setupStep: 4,
        setupCompletedAt: new Date(),
        lifecycleStatus: "ACTIVE",
      },
      select: organizationSetupSelect,
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_ONBOARDING_COMPLETED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: {
        lifecycleStatus: updated.lifecycleStatus,
        verificationStatus: updated.verificationStatus,
        capabilityCount: updated.capabilities.length,
      },
      ...meta,
    });
    return updated;
  });
  await captureServerProductEvent({
    distinctId: actor.id,
    event: PRODUCT_EVENTS.ORGANIZATION_ONBOARDING_COMPLETED,
    properties: { organization_type: completed.type },
  });
  return safeOrganizationDto(completed);
}

export async function getOrganizationForSetup(
  actor: Actor,
  organizationId: string,
) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      ...organizationSetupSelect,
      memberships: {
        where: { userId: actor.id },
        select: { role: true, status: true },
        take: 1,
      },
    },
  });
  if (!organization)
    throw new OrganizationError("Organization not found.", 404);
  const { memberships, ...record } = organization;
  if (
    !canViewOrganizationDraft({
      membership: memberships[0],
      globalRole: actor.role,
    })
  ) {
    throw new OrganizationError(
      "You do not have permission to view this organization draft.",
      403,
    );
  }
  return safeOrganizationDto(record);
}

export async function findOwnedOrganizationDraft(userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: {
      userId,
      role: "OWNER",
      status: "ACTIVE",
      organization: {
        lifecycleStatus: "DRAFT",
        setupCompletedAt: null,
      },
    },
    orderBy: { updatedAt: "desc" },
    select: {
      organization: { select: organizationSetupSelect },
    },
  });
  return membership ? safeOrganizationDto(membership.organization) : null;
}

export function getOrganizationOnboardingMemberships(userId: string) {
  return prisma.organizationMembership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      role: true,
      status: true,
      organization: {
        select: {
          lifecycleStatus: true,
          setupCompletedAt: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function listManagedOrganizations(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: {
      userId,
      status: "ACTIVE",
      organization: { lifecycleStatus: { not: "ARCHIVED" } },
    },
    select: {
      role: true,
      organization: { select: organizationSetupSelect },
    },
    orderBy: { updatedAt: "desc" },
  });
  return memberships.map(({ role, organization }) => ({
    role,
    organization: safeOrganizationDto(organization),
  }));
}

export async function archiveOrganization(
  actor: Actor,
  organizationId: string,
  meta: RequestMeta = {},
) {
  return prisma.$transaction(async (tx) => {
    const membership = await membershipFor(tx, organizationId, actor.id);
    if (!canDeleteOrArchiveOrganization(membership)) {
      throw new OrganizationError(
        "Only the organization owner can archive it.",
        403,
      );
    }
    const updated = await tx.organization.update({
      where: { id: organizationId },
      data: { lifecycleStatus: "ARCHIVED", archivedAt: new Date() },
      select: organizationSetupSelect,
    });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      organizationId,
      action: "ORGANIZATION_ARCHIVED",
      entityType: "Organization",
      entityId: organizationId,
      newValue: { lifecycleStatus: "ARCHIVED" },
      ...meta,
    });
    return safeOrganizationDto(updated);
  });
}
