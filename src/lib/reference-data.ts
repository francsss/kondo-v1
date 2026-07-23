import { Prisma } from "@prisma/client";
import { writeAuditLogWithClient } from "@/lib/audit";
import { AFRICAN_COUNTRY_CODES } from "@/lib/african-countries";
import { hasAdminPermission } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const REFERENCE_TYPES = ["countries", "cities", "universities"] as const;

export type ReferenceType = (typeof REFERENCE_TYPES)[number];
type ReferenceActor = { id: string; role: string };
type RequestMetadata = {
  ipAddress?: string | null;
  userAgent?: string | null;
};
type ReferenceClient = Pick<
  Prisma.TransactionClient,
  "country" | "city" | "university"
>;

export class ReferenceDataError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ReferenceDataError";
  }
}

export function parseReferenceType(value: string): ReferenceType | null {
  return REFERENCE_TYPES.includes(value as ReferenceType)
    ? (value as ReferenceType)
    : null;
}

function assertReferencePermission(
  actor: ReferenceActor,
  permission: "REFERENCE_DATA_VIEW" | "REFERENCE_DATA_MANAGE",
) {
  if (!hasAdminPermission(actor.role, permission)) {
    throw new ReferenceDataError("Access denied.", 403);
  }
}

function pagination(input: { page?: number; pageSize?: number }) {
  const page = Number.isFinite(input.page)
    ? Math.max(1, Math.floor(input.page ?? 1))
    : 1;
  const pageSize = Number.isFinite(input.pageSize)
    ? Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 25)))
    : 25;
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function pageResult<T>(
  records: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    records,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listReferenceData(
  actor: ReferenceActor,
  type: ReferenceType,
  input: { page?: number; pageSize?: number; query?: string } = {},
) {
  assertReferencePermission(actor, "REFERENCE_DATA_VIEW");
  const { page, pageSize, skip } = pagination(input);
  const query = input.query?.trim();

  if (type === "countries") {
    const where: Prisma.CountryWhereInput = query
      ? {
          OR: [
            { code: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : {};
    const [total, records] = await Promise.all([
      prisma.country.count({ where }),
      prisma.country.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          code: true,
          name: true,
          emoji: true,
          isActive: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { cities: true, universities: true, users: true },
          },
        },
      }),
    ]);
    return pageResult(
      records.map((record) => ({
        type: "country" as const,
        id: record.id,
        code: record.code,
        name: record.name,
        emoji: record.emoji,
        isActive: record.isActive,
        verified: record.verified,
        cityCount: record._count.cities,
        universityCount: record._count.universities,
        userCount: record._count.users,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }

  if (type === "cities") {
    const where: Prisma.CityWhereInput = query
      ? {
          OR: [
            { slug: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
            { province: { contains: query, mode: "insensitive" } },
            { country: { name: { contains: query, mode: "insensitive" } } },
          ],
        }
      : {};
    const [total, records] = await Promise.all([
      prisma.city.count({ where }),
      prisma.city.findMany({
        where,
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          name: true,
          province: true,
          countryId: true,
          country: { select: { code: true, name: true } },
          isActive: true,
          verified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { universities: true, users: true, listings: true },
          },
        },
      }),
    ]);
    return pageResult(
      records.map((record) => ({
        type: "city" as const,
        id: record.id,
        slug: record.slug,
        name: record.name,
        province: record.province,
        countryId: record.countryId,
        countryCode: record.country.code,
        countryName: record.country.name,
        isActive: record.isActive,
        verified: record.verified,
        universityCount: record._count.universities,
        userCount: record._count.users,
        listingCount: record._count.listings,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    );
  }

  const where: Prisma.UniversityWhereInput = query
    ? {
        OR: [
          { slug: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { shortName: { contains: query, mode: "insensitive" } },
          { city: { name: { contains: query, mode: "insensitive" } } },
        ],
      }
    : {};
  const [total, records] = await Promise.all([
    prisma.university.count({ where }),
    prisma.university.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        countryId: true,
        country: { select: { code: true, name: true } },
        cityId: true,
        city: { select: { name: true } },
        isActive: true,
        verified: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { users: true, communities: true } },
      },
    }),
  ]);
  return pageResult(
    records.map((record) => ({
      type: "university" as const,
      id: record.id,
      slug: record.slug,
      name: record.name,
      shortName: record.shortName,
      countryId: record.countryId,
      countryCode: record.country.code,
      countryName: record.country.name,
      cityId: record.cityId,
      cityName: record.city.name,
      isActive: record.isActive,
      verified: record.verified,
      userCount: record._count.users,
      communityCount: record._count.communities,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  );
}

export async function listReferenceOptions(actor: ReferenceActor) {
  assertReferencePermission(actor, "REFERENCE_DATA_VIEW");
  const [countries, cities] = await Promise.all([
    prisma.country.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    }),
    prisma.city.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        countryId: true,
        isActive: true,
        country: { select: { code: true } },
      },
    }),
  ]);
  return {
    countries,
    cities: cities.map((city) => ({
      id: city.id,
      name: city.name,
      countryId: city.countryId,
      countryCode: city.country.code,
      isActive: city.isActive,
    })),
  };
}

export async function getOnboardingReferenceData() {
  const [countries, cities, universities] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true, code: { in: AFRICAN_COUNTRY_CODES } },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, emoji: true },
    }),
    prisma.city.findMany({
      where: {
        isActive: true,
        country: { isActive: true, code: "CN" },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        province: true,
        countryId: true,
      },
    }),
    prisma.university.findMany({
      where: {
        isActive: true,
        verified: true,
        country: { isActive: true, code: "CN" },
        city: { isActive: true },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortName: true,
        countryId: true,
        cityId: true,
        city: { select: { name: true } },
      },
    }),
  ]);
  return {
    countries,
    cities,
    universities: universities.map((university) => ({
      id: university.id,
      name: university.name,
      shortName: university.shortName,
      countryId: university.countryId,
      cityId: university.cityId,
      cityName: university.city.name,
    })),
  };
}

export async function validateOnboardingReferences(
  input: { countryId: string; cityId: string; universityId: string },
  client: ReferenceClient = prisma,
) {
  const country = await client.country.findFirst({
    where: {
      id: input.countryId,
      isActive: true,
      code: { in: AFRICAN_COUNTRY_CODES },
    },
    select: { id: true },
  });
  if (!country) {
    throw new ReferenceDataError("Select an active country of origin.");
  }

  const city = await client.city.findFirst({
    where: {
      id: input.cityId,
      isActive: true,
      country: { isActive: true, code: "CN" },
    },
    select: { id: true, countryId: true },
  });
  if (!city) {
    throw new ReferenceDataError("Select an active study city.");
  }

  const university = await client.university.findFirst({
    where: {
      id: input.universityId,
      cityId: city.id,
      countryId: city.countryId,
      isActive: true,
      verified: true,
    },
    select: { id: true },
  });
  if (!university) {
    throw new ReferenceDataError(
      "Select an active verified university in the chosen city.",
    );
  }
}

type CountryInput = {
  code: string;
  name: string;
  emoji?: string | null;
  isActive: boolean;
  verified: boolean;
};
type CityInput = {
  slug: string;
  name: string;
  province?: string | null;
  countryId: string;
  isActive: boolean;
  verified: boolean;
};
type UniversityInput = {
  slug: string;
  name: string;
  shortName?: string | null;
  cityId: string;
  isActive: boolean;
  verified: boolean;
};

function mutationRecord(
  type: "country" | "city" | "university",
  record: {
    id: string;
    isActive: boolean;
    verified: boolean;
    name: string;
  } & Record<string, unknown>,
) {
  return { type, ...record };
}

export async function createReferenceData(
  actor: ReferenceActor,
  type: ReferenceType,
  data: CountryInput | CityInput | UniversityInput,
  metadata: RequestMetadata = {},
) {
  assertReferencePermission(actor, "REFERENCE_DATA_MANAGE");
  try {
    return await prisma.$transaction(async (tx) => {
      if (type === "countries") {
        const input = data as CountryInput;
        const created = await tx.country.create({
          data: input,
          select: {
            id: true,
            code: true,
            name: true,
            emoji: true,
            isActive: true,
            verified: true,
          },
        });
        const result = mutationRecord("country", created);
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          action: "REFERENCE_COUNTRY_CREATED",
          entityType: "Country",
          entityId: created.id,
          newValue: result,
          ...metadata,
        });
        return result;
      }

      if (type === "cities") {
        const input = data as CityInput;
        const country = await tx.country.findUnique({
          where: { id: input.countryId },
          select: { id: true },
        });
        if (!country) throw new ReferenceDataError("Country not found.", 404);
        const created = await tx.city.create({
          data: input,
          select: {
            id: true,
            slug: true,
            name: true,
            province: true,
            countryId: true,
            isActive: true,
            verified: true,
          },
        });
        const result = mutationRecord("city", created);
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          action: "REFERENCE_CITY_CREATED",
          entityType: "City",
          entityId: created.id,
          newValue: result,
          ...metadata,
        });
        return result;
      }

      const input = data as UniversityInput;
      const city = await tx.city.findUnique({
        where: { id: input.cityId },
        select: { id: true, countryId: true },
      });
      if (!city) throw new ReferenceDataError("City not found.", 404);
      const created = await tx.university.create({
        data: { ...input, countryId: city.countryId },
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          countryId: true,
          cityId: true,
          isActive: true,
          verified: true,
        },
      });
      const result = mutationRecord("university", created);
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "REFERENCE_UNIVERSITY_CREATED",
        entityType: "University",
        entityId: created.id,
        newValue: result,
        ...metadata,
      });
      return result;
    });
  } catch (error) {
    if (error instanceof ReferenceDataError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ReferenceDataError(
        "A reference record already uses that code, slug, or name.",
        409,
      );
    }
    throw error;
  }
}

export async function updateReferenceData(
  actor: ReferenceActor,
  type: ReferenceType,
  id: string,
  data: Partial<CountryInput & CityInput & UniversityInput>,
  metadata: RequestMetadata = {},
) {
  assertReferencePermission(actor, "REFERENCE_DATA_MANAGE");
  try {
    return await prisma.$transaction(async (tx) => {
      if (type === "countries") {
        const existing = await tx.country.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            name: true,
            emoji: true,
            isActive: true,
            verified: true,
          },
        });
        if (!existing) throw new ReferenceDataError("Country not found.", 404);
        const updated = await tx.country.update({
          where: { id },
          data: {
            code: data.code,
            name: data.name,
            emoji: data.emoji,
            isActive: data.isActive,
            verified: data.verified,
          },
          select: {
            id: true,
            code: true,
            name: true,
            emoji: true,
            isActive: true,
            verified: true,
          },
        });
        const result = mutationRecord("country", updated);
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          action: "REFERENCE_COUNTRY_UPDATED",
          entityType: "Country",
          entityId: id,
          oldValue: mutationRecord("country", existing),
          newValue: result,
          ...metadata,
        });
        return result;
      }

      if (type === "cities") {
        const existing = await tx.city.findUnique({
          where: { id },
          select: {
            id: true,
            slug: true,
            name: true,
            province: true,
            countryId: true,
            isActive: true,
            verified: true,
          },
        });
        if (!existing) throw new ReferenceDataError("City not found.", 404);
        if (data.countryId) {
          const country = await tx.country.findUnique({
            where: { id: data.countryId },
            select: { id: true },
          });
          if (!country) throw new ReferenceDataError("Country not found.", 404);
        }
        const updated = await tx.city.update({
          where: { id },
          data: {
            slug: data.slug,
            name: data.name,
            province: data.province,
            countryId: data.countryId,
            isActive: data.isActive,
            verified: data.verified,
          },
          select: {
            id: true,
            slug: true,
            name: true,
            province: true,
            countryId: true,
            isActive: true,
            verified: true,
          },
        });
        const result = mutationRecord("city", updated);
        await writeAuditLogWithClient(tx, {
          actorId: actor.id,
          action: "REFERENCE_CITY_UPDATED",
          entityType: "City",
          entityId: id,
          oldValue: mutationRecord("city", existing),
          newValue: result,
          ...metadata,
        });
        return result;
      }

      const existing = await tx.university.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          countryId: true,
          cityId: true,
          isActive: true,
          verified: true,
        },
      });
      if (!existing) throw new ReferenceDataError("University not found.", 404);
      const targetCityId = data.cityId ?? existing.cityId;
      const city = await tx.city.findUnique({
        where: { id: targetCityId },
        select: { id: true, countryId: true },
      });
      if (!city) throw new ReferenceDataError("City not found.", 404);
      const updated = await tx.university.update({
        where: { id },
        data: {
          slug: data.slug,
          name: data.name,
          shortName: data.shortName,
          cityId: data.cityId,
          countryId: city.countryId,
          isActive: data.isActive,
          verified: data.verified,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          shortName: true,
          countryId: true,
          cityId: true,
          isActive: true,
          verified: true,
        },
      });
      const result = mutationRecord("university", updated);
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "REFERENCE_UNIVERSITY_UPDATED",
        entityType: "University",
        entityId: id,
        oldValue: mutationRecord("university", existing),
        newValue: result,
        ...metadata,
      });
      return result;
    });
  } catch (error) {
    if (error instanceof ReferenceDataError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ReferenceDataError(
        "A reference record already uses that code, slug, or name.",
        409,
      );
    }
    throw error;
  }
}

export async function deleteReferenceData(
  actor: ReferenceActor,
  type: ReferenceType,
  id: string,
  metadata: RequestMetadata = {},
) {
  assertReferencePermission(actor, "REFERENCE_DATA_MANAGE");
  return prisma.$transaction(async (tx) => {
    if (type === "countries") {
      const existing = await tx.country.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          name: true,
          emoji: true,
          isActive: true,
          verified: true,
          _count: {
            select: {
              cities: true,
              universities: true,
              users: true,
              communities: true,
            },
          },
        },
      });
      if (!existing) throw new ReferenceDataError("Country not found.", 404);
      if (Object.values(existing._count).some(Boolean)) {
        throw new ReferenceDataError(
          "Deactivate this country instead; dependent records still use it.",
          409,
        );
      }
      await tx.country.delete({ where: { id } });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "REFERENCE_COUNTRY_DELETED",
        entityType: "Country",
        entityId: id,
        oldValue: mutationRecord("country", {
          id: existing.id,
          code: existing.code,
          name: existing.name,
          emoji: existing.emoji,
          isActive: existing.isActive,
          verified: existing.verified,
        }),
        ...metadata,
      });
      return { deleted: true, id, type: "country" as const };
    }

    if (type === "cities") {
      const existing = await tx.city.findUnique({
        where: { id },
        select: {
          id: true,
          slug: true,
          name: true,
          province: true,
          countryId: true,
          isActive: true,
          verified: true,
          _count: {
            select: {
              universities: true,
              users: true,
              communities: true,
              listings: true,
            },
          },
        },
      });
      if (!existing) throw new ReferenceDataError("City not found.", 404);
      if (Object.values(existing._count).some(Boolean)) {
        throw new ReferenceDataError(
          "Deactivate this city instead; dependent records still use it.",
          409,
        );
      }
      await tx.city.delete({ where: { id } });
      await writeAuditLogWithClient(tx, {
        actorId: actor.id,
        action: "REFERENCE_CITY_DELETED",
        entityType: "City",
        entityId: id,
        oldValue: mutationRecord("city", {
          id: existing.id,
          slug: existing.slug,
          name: existing.name,
          province: existing.province,
          countryId: existing.countryId,
          isActive: existing.isActive,
          verified: existing.verified,
        }),
        ...metadata,
      });
      return { deleted: true, id, type: "city" as const };
    }

    const existing = await tx.university.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        countryId: true,
        cityId: true,
        isActive: true,
        verified: true,
        _count: { select: { users: true, communities: true } },
      },
    });
    if (!existing) throw new ReferenceDataError("University not found.", 404);
    if (Object.values(existing._count).some(Boolean)) {
      throw new ReferenceDataError(
        "Deactivate this university instead; dependent records still use it.",
        409,
      );
    }
    await tx.university.delete({ where: { id } });
    await writeAuditLogWithClient(tx, {
      actorId: actor.id,
      action: "REFERENCE_UNIVERSITY_DELETED",
      entityType: "University",
      entityId: id,
      oldValue: mutationRecord("university", {
        id: existing.id,
        slug: existing.slug,
        name: existing.name,
        shortName: existing.shortName,
        countryId: existing.countryId,
        cityId: existing.cityId,
        isActive: existing.isActive,
        verified: existing.verified,
      }),
      ...metadata,
    });
    return { deleted: true, id, type: "university" as const };
  });
}
