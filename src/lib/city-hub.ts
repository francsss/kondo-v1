import { Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";
import { getExploreCity, listExploreCities } from "@/features/explore/registry";
import type {
  ExploreCity,
  ExploreEntry,
  ExploreSection,
} from "@/features/explore/types";
import { cityHubContentMetrics } from "@/lib/city-hub-metrics";
import { logServerError } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { exploreCityPayloadSchema } from "@/lib/validation";

type Actor = { id: string; role: AppRole | string };
type RequestMeta = { ipAddress?: string | null; userAgent?: string | null };

export type CityHubStatus = "DRAFT" | "REVIEW" | "PUBLISHED";
export type CityHubSort = "students" | "needs-content" | "activity" | "recent";

export class CityHubError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CityHubError";
  }
}

// DRAFT -> REVIEW -> PUBLISHED, with the ability to send a hub back to draft
// from either review or published so its content can be revised. Publishing is
// the only transition that overwrites the live `published` snapshot, so the
// public site keeps serving the previous version until a revision is
// re-published. Guarded here in addition to the permission check.
const ALLOWED_TRANSITIONS: Record<CityHubStatus, readonly CityHubStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["DRAFT"],
};

const TRANSITION_ACTION: Record<CityHubStatus, string> = {
  DRAFT: "CITY_HUB_REVERTED_TO_DRAFT",
  REVIEW: "CITY_HUB_SUBMITTED_FOR_REVIEW",
  PUBLISHED: "CITY_HUB_PUBLISHED",
};

function scaffoldDraft(input: {
  slug: string;
  name: string;
  province: string | null;
  country: string;
}): ExploreCity {
  const { slug, name } = input;
  return {
    slug,
    name,
    province: input.province?.trim() || "China",
    country: input.country,
    eyebrow: `Kondo city guide · ${name}`,
    title: `${name}, open by design.`,
    tagline: `Discover ${name}.`,
    summary: `A student-first gateway to ${name}.`,
    description: `An editorial city hub for ${name}.`,
    signals: [],
    impactPoints: [],
    sections: [
      {
        slug: "companies",
        title: "Local Companies",
        shortTitle: "Companies",
        eyebrow: `Built in ${name}`,
        summary: "Meet the organisations shaping the local economy.",
        description: "Add the companies and ecosystems worth knowing here.",
        icon: "companies",
        accent: "emerald",
        signal: "Company spotlights",
        studentValue: "Understand local industries before applying.",
        cityValue: "Present local employers to international students.",
        entries: [],
      },
      {
        slug: "jobs",
        title: "Jobs & Internships",
        shortTitle: "Jobs",
        eyebrow: `Opportunities in ${name}`,
        summary: "Find internships, jobs, and student project pathways.",
        description:
          "Add verified opportunities, requirements, deadlines, and application links.",
        icon: "jobs",
        accent: "blue",
        signal: "Opportunity board",
        studentValue: "Move from local discovery to practical experience.",
        cityValue: "Connect local organisations with international talent.",
        entries: [],
      },
      {
        slug: "restaurants",
        title: "Restaurants & Food",
        shortTitle: "Food",
        eyebrow: `Eat well in ${name}`,
        summary:
          "Discover reliable places to eat and student-friendly options.",
        description:
          "Add restaurants, cafés, dietary information, prices, and practical directions.",
        icon: "services",
        accent: "amber",
        signal: "Local dining guide",
        studentValue: "Find trusted food options without trial and error.",
        cityValue: "Help local businesses welcome international students.",
        entries: [],
      },
      {
        slug: "housing",
        title: "Housing",
        shortTitle: "Housing",
        eyebrow: `Live in ${name}`,
        summary: "Understand neighbourhoods, rent, and accommodation options.",
        description:
          "Add verified housing guidance, providers, prices, and tenant resources.",
        icon: "services",
        accent: "violet",
        signal: "Housing essentials",
        studentValue: "Make safer, better-informed accommodation decisions.",
        cityValue: "Improve access to reliable housing information.",
        entries: [],
      },
      {
        slug: "events",
        title: "Events",
        shortTitle: "Events",
        eyebrow: `What's happening in ${name}`,
        summary: "Follow campus, cultural, professional, and city events.",
        description:
          "Add dates, venues, organisers, registration details, and updates.",
        icon: "events",
        accent: "rose",
        signal: "City calendar",
        studentValue: "Join useful events and build local connections.",
        cityValue: "Increase participation in city and campus life.",
        entries: [],
      },
      {
        slug: "services",
        title: "Useful Places & Services",
        shortTitle: "Services",
        eyebrow: `Everyday ${name}`,
        summary: "Find essential services and useful places with confidence.",
        description:
          "Add healthcare, transport, administration, shopping, emergency, and daily-life resources.",
        icon: "services",
        accent: "cyan",
        signal: "Practical city guide",
        studentValue: "Solve everyday needs faster and more safely.",
        cityValue: "Make local services easier to understand and access.",
        entries: [],
      },
    ],
  };
}

export async function listAdminCityHubs(
  actor: Actor,
  input: {
    page?: number;
    pageSize?: number;
    query?: string;
    status?: CityHubStatus;
    sort?: CityHubSort;
  } = {},
) {
  if (!hasAdminPermission(actor.role, "CITY_CMS_VIEW")) {
    throw new CityHubError("Access denied.", 403);
  }
  const page = Math.max(1, Math.floor(input.page ?? 1));
  const pageSize = Math.min(50, Math.max(5, Math.floor(input.pageSize ?? 20)));
  const sort = input.sort ?? "students";
  const cityWhere: Prisma.CityWhereInput = {
    isActive: true,
    country: { isActive: true, code: "CN" },
    users: { some: { status: "ACTIVE" } },
    ...(input.query
      ? {
          OR: [
            { name: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
            { province: { contains: input.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const cities = await prisma.city.findMany({
    where: cityWhere,
    select: {
      id: true,
      slug: true,
      name: true,
      province: true,
      createdAt: true,
      country: { select: { name: true } },
      cityHub: {
        select: {
          id: true,
          slug: true,
          status: true,
          version: true,
          draft: true,
          publishedAt: true,
          updatedAt: true,
        },
      },
      _count: {
        select: { users: { where: { status: "ACTIVE" } } },
      },
    },
  });
  const cityIds = cities.map((city) => city.id);
  const activeSince = new Date();
  activeSince.setDate(activeSince.getDate() - 30);
  const activeUserGroups = cityIds.length
    ? await prisma.user.groupBy({
        by: ["cityId"],
        where: {
          cityId: { in: cityIds },
          status: "ACTIVE",
          lastActiveAt: { gte: activeSince },
        },
        _count: { _all: true },
      })
    : [];
  const activeUsersByCity = new Map(
    activeUserGroups.flatMap((group) =>
      group.cityId ? [[group.cityId, group._count._all] as const] : [],
    ),
  );

  const records = cities
    .map((city) => {
      const hub = city.cityHub;
      const parsed = hub ? exploreCityPayloadSchema.safeParse(hub.draft) : null;
      const metrics = cityHubContentMetrics(
        parsed?.success ? (parsed.data as ExploreCity) : null,
      );
      return {
        cityId: city.id,
        slug: hub?.slug ?? city.slug,
        name: city.name,
        province: city.province,
        country: city.country.name,
        userCount: city._count.users,
        activeUserCount: activeUsersByCity.get(city.id) ?? 0,
        createdAt: city.createdAt.toISOString(),
        hubId: hub?.id ?? null,
        status: (hub?.status as CityHubStatus | undefined) ?? null,
        version: hub?.version ?? null,
        publishedAt: hub?.publishedAt?.toISOString() ?? null,
        updatedAt: hub?.updatedAt.toISOString() ?? null,
        ...metrics,
      };
    })
    .filter((record) => !input.status || record.status === input.status);

  records.sort((left, right) => {
    if (sort === "needs-content") {
      return (
        left.totalEntries - right.totalEntries ||
        left.completion - right.completion ||
        right.userCount - left.userCount ||
        left.name.localeCompare(right.name)
      );
    }
    if (sort === "activity") {
      return (
        right.activeUserCount - left.activeUserCount ||
        right.userCount - left.userCount ||
        right.totalEntries - left.totalEntries ||
        left.name.localeCompare(right.name)
      );
    }
    if (sort === "recent") {
      return (
        new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime() ||
        left.name.localeCompare(right.name)
      );
    }
    return (
      right.userCount - left.userCount ||
      right.activeUserCount - left.activeUserCount ||
      left.name.localeCompare(right.name)
    );
  });

  const total = records.length;
  const pageRecords = records.slice((page - 1) * pageSize, page * pageSize);
  return {
    records: pageRecords,
    summary: {
      activeCities: total,
      students: records.reduce((totalUsers, city) => {
        return totalUsers + city.userCount;
      }, 0),
      citiesWithoutContent: records.filter((city) => city.totalEntries === 0)
        .length,
      averageCompletion: total
        ? Math.round(
            records.reduce((sum, city) => sum + city.completion, 0) / total,
          )
        : 0,
    },
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    total,
  };
}

export async function getAdminCityHub(actor: Actor, hubId: string) {
  if (!hasAdminPermission(actor.role, "CITY_CMS_VIEW")) {
    throw new CityHubError("Access denied.", 403);
  }
  const hub = await prisma.cityHub.findUnique({
    where: { id: hubId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      version: true,
      draft: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!hub) return null;
  return {
    ...hub,
    publishedAt: hub.publishedAt?.toISOString() ?? null,
    createdAt: hub.createdAt.toISOString(),
    updatedAt: hub.updatedAt.toISOString(),
  };
}

type CityHubDetails = Omit<ExploreCity, "sections">;
type CityHubSectionDetails = Omit<ExploreSection, "entries">;

function editableDraft(value: Prisma.JsonValue, hubSlug: string): ExploreCity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CityHubError("This city hub draft is malformed.", 422);
  }
  const draft = structuredClone(value) as unknown as ExploreCity;
  if (draft.slug !== hubSlug || !Array.isArray(draft.sections)) {
    throw new CityHubError("This city hub draft is malformed.", 422);
  }
  return draft;
}

async function mutateCityHubDraft(input: {
  actor: Actor;
  hubId: string;
  expectedVersion: number;
  action: string;
  auditValue: Record<string, unknown>;
  mutate: (draft: ExploreCity) => ExploreCity;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "CITY_CMS_MANAGE")) {
    throw new CityHubError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const hub = await tx.cityHub.findUnique({
      where: { id: input.hubId },
      select: {
        id: true,
        slug: true,
        status: true,
        version: true,
        draft: true,
      },
    });
    if (!hub) throw new CityHubError("City hub not found.", 404);
    if (hub.status !== "DRAFT") {
      throw new CityHubError(
        "Move this hub back to draft before editing its content.",
        409,
      );
    }
    if (hub.version !== input.expectedVersion) {
      throw new CityHubError(
        "This hub changed since you loaded it. Reload and try again.",
        409,
      );
    }

    const nextDraft = input.mutate(editableDraft(hub.draft, hub.slug));
    const updated = await tx.cityHub.updateMany({
      where: {
        id: hub.id,
        status: "DRAFT",
        version: input.expectedVersion,
      },
      data: {
        name: nextDraft.name,
        draft: nextDraft as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedById: input.actor.id,
      },
    });
    if (updated.count !== 1) {
      throw new CityHubError(
        "This hub changed since you loaded it. Reload and try again.",
        409,
      );
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: input.action,
      entityType: "CityHub",
      entityId: hub.id,
      newValue: {
        ...input.auditValue,
        version: input.expectedVersion + 1,
      },
      ...input.meta,
    });
    return {
      hub: {
        id: hub.id,
        status: "DRAFT" as const,
        version: input.expectedVersion + 1,
      },
    };
  });
}

export async function updateCityHubDetails(input: {
  actor: Actor;
  hubId: string;
  data: { payload: CityHubDetails; expectedVersion: number };
  meta?: RequestMeta;
}) {
  return mutateCityHubDraft({
    actor: input.actor,
    hubId: input.hubId,
    expectedVersion: input.data.expectedVersion,
    action: "CITY_HUB_DETAILS_UPDATED",
    auditValue: { scope: "details" },
    meta: input.meta,
    mutate: (draft) => {
      if (input.data.payload.slug !== draft.slug) {
        throw new CityHubError(
          "The payload slug must match this hub's slug.",
          400,
        );
      }
      return { ...input.data.payload, sections: draft.sections };
    },
  });
}

export async function updateCityHubSection(input: {
  actor: Actor;
  hubId: string;
  sectionSlug: string;
  data: { payload: CityHubSectionDetails; expectedVersion: number };
  meta?: RequestMeta;
}) {
  return mutateCityHubDraft({
    actor: input.actor,
    hubId: input.hubId,
    expectedVersion: input.data.expectedVersion,
    action: "CITY_HUB_SECTION_UPDATED",
    auditValue: { sectionSlug: input.sectionSlug },
    meta: input.meta,
    mutate: (draft) => {
      if (input.data.payload.slug !== input.sectionSlug) {
        throw new CityHubError("A section slug cannot be changed.", 400);
      }
      const sectionIndex = draft.sections.findIndex(
        (section) => section.slug === input.sectionSlug,
      );
      if (sectionIndex < 0) {
        throw new CityHubError("City hub section not found.", 404);
      }
      const current = draft.sections[sectionIndex]!;
      const sections = [...draft.sections];
      sections[sectionIndex] = {
        ...input.data.payload,
        entries: current.entries,
      };
      return { ...draft, sections };
    },
  });
}

function assertUniqueEntry(
  draft: ExploreCity,
  section: ExploreSection,
  entry: ExploreEntry,
  currentEntryId?: string,
) {
  if (
    draft.sections.some((candidate) =>
      candidate.entries.some(
        (item) => item.id === entry.id && item.id !== currentEntryId,
      ),
    )
  ) {
    throw new CityHubError("An entry with that ID already exists.", 409);
  }
  if (
    section.entries.some(
      (item) => item.slug === entry.slug && item.id !== currentEntryId,
    )
  ) {
    throw new CityHubError(
      "An entry with that slug already exists in this section.",
      409,
    );
  }
}

export async function createCityHubEntry(input: {
  actor: Actor;
  hubId: string;
  sectionSlug: string;
  data: { payload: ExploreEntry; expectedVersion: number };
  meta?: RequestMeta;
}) {
  return mutateCityHubDraft({
    actor: input.actor,
    hubId: input.hubId,
    expectedVersion: input.data.expectedVersion,
    action: "CITY_HUB_ENTRY_CREATED",
    auditValue: {
      sectionSlug: input.sectionSlug,
      entryId: input.data.payload.id,
    },
    meta: input.meta,
    mutate: (draft) => {
      const sectionIndex = draft.sections.findIndex(
        (section) => section.slug === input.sectionSlug,
      );
      if (sectionIndex < 0) {
        throw new CityHubError("City hub section not found.", 404);
      }
      const section = draft.sections[sectionIndex]!;
      if (section.entries.length >= 50) {
        throw new CityHubError("This section already has 50 entries.", 409);
      }
      assertUniqueEntry(draft, section, input.data.payload);
      const sections = [...draft.sections];
      sections[sectionIndex] = {
        ...section,
        entries: [...section.entries, input.data.payload],
      };
      return { ...draft, sections };
    },
  });
}

export async function updateCityHubEntry(input: {
  actor: Actor;
  hubId: string;
  sectionSlug: string;
  entryId: string;
  data: { payload: ExploreEntry; expectedVersion: number };
  meta?: RequestMeta;
}) {
  return mutateCityHubDraft({
    actor: input.actor,
    hubId: input.hubId,
    expectedVersion: input.data.expectedVersion,
    action: "CITY_HUB_ENTRY_UPDATED",
    auditValue: { sectionSlug: input.sectionSlug, entryId: input.entryId },
    meta: input.meta,
    mutate: (draft) => {
      const sectionIndex = draft.sections.findIndex(
        (section) => section.slug === input.sectionSlug,
      );
      if (sectionIndex < 0) {
        throw new CityHubError("City hub section not found.", 404);
      }
      const section = draft.sections[sectionIndex]!;
      const entryIndex = section.entries.findIndex(
        (entry) => entry.id === input.entryId,
      );
      if (entryIndex < 0) throw new CityHubError("Entry not found.", 404);
      if (input.data.payload.id !== input.entryId) {
        throw new CityHubError("An entry ID cannot be changed.", 400);
      }
      assertUniqueEntry(draft, section, input.data.payload, input.entryId);
      const entries = [...section.entries];
      entries[entryIndex] = input.data.payload;
      const sections = [...draft.sections];
      sections[sectionIndex] = { ...section, entries };
      return { ...draft, sections };
    },
  });
}

export async function deleteCityHubEntry(input: {
  actor: Actor;
  hubId: string;
  sectionSlug: string;
  entryId: string;
  expectedVersion: number;
  meta?: RequestMeta;
}) {
  return mutateCityHubDraft({
    actor: input.actor,
    hubId: input.hubId,
    expectedVersion: input.expectedVersion,
    action: "CITY_HUB_ENTRY_DELETED",
    auditValue: { sectionSlug: input.sectionSlug, entryId: input.entryId },
    meta: input.meta,
    mutate: (draft) => {
      const sectionIndex = draft.sections.findIndex(
        (section) => section.slug === input.sectionSlug,
      );
      if (sectionIndex < 0) {
        throw new CityHubError("City hub section not found.", 404);
      }
      const section = draft.sections[sectionIndex]!;
      if (!section.entries.some((entry) => entry.id === input.entryId)) {
        throw new CityHubError("Entry not found.", 404);
      }
      const sections = [...draft.sections];
      sections[sectionIndex] = {
        ...section,
        entries: section.entries.filter((entry) => entry.id !== input.entryId),
      };
      return { ...draft, sections };
    },
  });
}

export async function createCityHub(input: {
  actor: Actor;
  data: { cityId: string };
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "CITY_CMS_MANAGE")) {
    throw new CityHubError("Access denied.", 403);
  }
  const city = await prisma.city.findFirst({
    where: {
      id: input.data.cityId,
      isActive: true,
      country: { isActive: true, code: "CN" },
      users: { some: { status: "ACTIVE" } },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      province: true,
      country: { select: { name: true } },
    },
  });
  if (!city) {
    throw new CityHubError(
      "A city becomes available after at least one active member selects it.",
      404,
    );
  }
  const registryCity =
    getExploreCity(city.slug) ??
    listExploreCities().find(
      (candidate) =>
        candidate.name.trim().toLocaleLowerCase() ===
        city.name.trim().toLocaleLowerCase(),
    );
  const slug = registryCity?.slug ?? city.slug;
  const existing = await prisma.cityHub.findFirst({
    where: {
      OR: [{ cityId: city.id }, { slug }],
    },
    select: { id: true },
  });
  if (existing) {
    throw new CityHubError(
      "A content workspace already exists for this city.",
      409,
    );
  }

  let draft: ExploreCity;
  if (registryCity) {
    // Normalise the readonly registry object into a validated plain payload.
    draft = exploreCityPayloadSchema.parse({
      ...registryCity,
      slug,
      name: city.name,
      province: city.province?.trim() || registryCity.province,
      country: city.country.name,
    }) as ExploreCity;
  } else {
    draft = scaffoldDraft({
      slug,
      name: city.name,
      province: city.province,
      country: city.country.name,
    });
  }

  return prisma.$transaction(async (tx) => {
    const hub = await tx.cityHub.create({
      data: {
        slug,
        name: city.name,
        cityId: city.id,
        status: "DRAFT",
        draft: draft as unknown as Prisma.InputJsonValue,
        createdById: input.actor.id,
        updatedById: input.actor.id,
      },
      select: { id: true, slug: true, name: true, status: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "CITY_HUB_CREATED",
      entityType: "CityHub",
      entityId: hub.id,
      newValue: {
        slug: hub.slug,
        cityId: city.id,
        seeded: Boolean(registryCity),
      },
      ...input.meta,
    });
    return { hub };
  });
}

export async function setCityHubStatus(input: {
  actor: Actor;
  hubId: string;
  status: CityHubStatus;
  expectedVersion: number;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "CITY_CMS_MANAGE")) {
    throw new CityHubError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const hub = await tx.cityHub.findUnique({
      where: { id: input.hubId },
      select: { id: true, status: true, version: true, draft: true },
    });
    if (!hub) throw new CityHubError("City hub not found.", 404);
    if (hub.version !== input.expectedVersion) {
      throw new CityHubError(
        "This hub changed since you loaded it. Reload and try again.",
        409,
      );
    }
    const current = hub.status as CityHubStatus;
    if (!ALLOWED_TRANSITIONS[current].includes(input.status)) {
      throw new CityHubError(
        `Cannot move a hub from ${current} to ${input.status}.`,
        409,
      );
    }

    const data: Prisma.CityHubUpdateInput = {
      status: input.status,
      version: { increment: 1 },
      updatedBy: { connect: { id: input.actor.id } },
    };

    if (input.status === "PUBLISHED") {
      // Integrity gate: never publish a payload that no longer conforms.
      const parsed = exploreCityPayloadSchema.safeParse(hub.draft);
      if (!parsed.success) {
        throw new CityHubError(
          "This hub's draft is invalid and cannot be published. Fix it in draft first.",
          422,
        );
      }
      data.published = parsed.data as unknown as Prisma.InputJsonValue;
      data.publishedAt = new Date();
    }

    const updated = await tx.cityHub.update({
      where: { id: hub.id },
      data,
      select: { id: true, status: true, version: true, publishedAt: true },
    });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: TRANSITION_ACTION[input.status],
      entityType: "CityHub",
      entityId: hub.id,
      oldValue: { status: current },
      newValue: { status: input.status },
      ...input.meta,
    });
    return {
      hub: {
        ...updated,
        publishedAt: updated.publishedAt?.toISOString() ?? null,
      },
    };
  });
}

export async function deleteCityHub(input: {
  actor: Actor;
  hubId: string;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "CITY_CMS_MANAGE")) {
    throw new CityHubError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const hub = await tx.cityHub.findUnique({
      where: { id: input.hubId },
      select: { id: true, slug: true, status: true, published: true },
    });
    if (!hub) throw new CityHubError("City hub not found.", 404);
    if (hub.status === "PUBLISHED" || hub.published != null) {
      throw new CityHubError(
        "Unpublish this hub before deleting its draft.",
        409,
      );
    }
    await tx.cityHub.delete({ where: { id: hub.id } });
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "CITY_HUB_DELETED",
      entityType: "CityHub",
      entityId: hub.id,
      oldValue: { slug: hub.slug },
      ...input.meta,
    });
    return { deleted: true };
  });
}

export async function unpublishCityHub(input: {
  actor: Actor;
  hubId: string;
  expectedVersion: number;
  meta?: RequestMeta;
}) {
  if (!hasAdminPermission(input.actor.role, "CITY_CMS_MANAGE")) {
    throw new CityHubError("Access denied.", 403);
  }
  return prisma.$transaction(async (tx) => {
    const hub = await tx.cityHub.findUnique({
      where: { id: input.hubId },
      select: { id: true, status: true, version: true, published: true },
    });
    if (!hub) throw new CityHubError("City hub not found.", 404);
    if (hub.published == null) {
      throw new CityHubError("This city hub has no live snapshot.", 409);
    }
    const updated = await tx.cityHub.updateMany({
      where: {
        id: hub.id,
        status: hub.status,
        version: input.expectedVersion,
      },
      data: {
        status: "DRAFT",
        published: Prisma.DbNull,
        publishedAt: null,
        version: { increment: 1 },
        updatedById: input.actor.id,
      },
    });
    if (updated.count !== 1) {
      throw new CityHubError(
        "This hub changed since you loaded it. Reload and try again.",
        409,
      );
    }
    await writeAuditLogWithClient(tx, {
      actorId: input.actor.id,
      action: "CITY_HUB_UNPUBLISHED",
      entityType: "CityHub",
      entityId: hub.id,
      oldValue: { status: hub.status },
      newValue: { status: "DRAFT", publicSnapshotRemoved: true },
      ...input.meta,
    });
    return { status: "DRAFT" as const, version: hub.version + 1 };
  });
}

/**
 * Public resolver: a missing row returns undefined so callers may use the
 * static registry. A managed but unpublished row returns null and must remain
 * absent publicly. Never throws; database failures degrade to the registry,
 * while malformed managed snapshots are logged and withheld.
 */
export async function resolvePublishedCity(
  slug: string,
): Promise<ExploreCity | null | undefined> {
  try {
    const hub = await prisma.cityHub.findUnique({
      where: { slug },
      select: { published: true },
    });
    // Serve the last published snapshot whenever one exists, regardless of the
    // current editorial status: reverting a hub to DRAFT to revise it must not
    // take the live public page down. The snapshot only changes on re-publish.
    if (!hub) return undefined;
    if (hub.published == null) return null;
    const parsed = exploreCityPayloadSchema.safeParse(hub.published);
    if (!parsed.success) {
      logServerError("city-hub.resolve", parsed.error, { slug });
      return null;
    }
    return parsed.data as ExploreCity;
  } catch (error) {
    logServerError("city-hub.resolve", error, { slug });
    return undefined;
  }
}
