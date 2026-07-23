import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { completeOnboarding, saveOnboardingDraft } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import {
  createReferenceData,
  deleteReferenceData,
  getOnboardingReferenceData,
  listReferenceData,
  ReferenceDataError,
  updateReferenceData,
  validateOnboardingReferences,
} from "@/lib/reference-data";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module4.test";
const namePrefix = "Module4";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function unusedCountryCode() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let attempt = 0; attempt < 676; attempt += 1) {
    const value = Math.floor(Math.random() * 676);
    const code = alphabet[Math.floor(value / 26)] + alphabet[value % 26];
    const existing = await prisma.country.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }
  throw new Error("No unused test country code is available.");
}

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const countries = await prisma.country.findMany({
    where: { name: { startsWith: namePrefix } },
    select: { id: true },
  });
  const cities = await prisma.city.findMany({
    where: { name: { startsWith: namePrefix } },
    select: { id: true },
  });
  const universities = await prisma.university.findMany({
    where: { name: { startsWith: namePrefix } },
    select: { id: true },
  });
  const entityIds = [
    ...users.map(({ id }) => id),
    ...countries.map(({ id }) => id),
    ...cities.map(({ id }) => id),
    ...universities.map(({ id }) => id),
  ];
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: users.map(({ id }) => id) } },
        { entityId: { in: entityIds } },
      ],
    },
  });
  await prisma.user.deleteMany({
    where: { id: { in: users.map(({ id }) => id) } },
  });
  await prisma.university.deleteMany({
    where: { id: { in: universities.map(({ id }) => id) } },
  });
  await prisma.city.deleteMany({
    where: { id: { in: cities.map(({ id }) => id) } },
  });
  await prisma.country.deleteMany({
    where: { id: { in: countries.map(({ id }) => id) } },
  });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const china = await prisma.country.upsert({
    where: { code: "CN" },
    update: { isActive: true, verified: true },
    create: {
      code: "CN",
      name: "China",
      emoji: "🇨🇳",
      isActive: true,
      verified: true,
    },
  });
  const admin = await prisma.user.create({
    data: {
      email: `admin-${suffix}@${testDomain}`,
      firstName: "Module4",
      lastName: "Admin",
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  const member = await prisma.user.create({
    data: {
      email: `member-${suffix}@${testDomain}`,
      firstName: "Module4",
      lastName: "Member",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const memberDraftOnly = await prisma.user.create({
    data: {
      email: `member-draft-${suffix}@${testDomain}`,
      firstName: "Module4",
      lastName: "DraftMember",
      role: "MEMBER",
      status: "ACTIVE",
    },
  });
  const origin = await prisma.country.upsert({
    where: { code: "SC" },
    update: {
      name: "Seychelles",
      emoji: "🇸🇨",
      isActive: true,
      verified: true,
    },
    create: {
      code: "SC",
      name: "Seychelles",
      emoji: "🇸🇨",
      isActive: true,
      verified: true,
    },
  });
  const cityA = await createReferenceData(admin, "cities", {
    slug: `module4-city-a-${suffix}`,
    name: `${namePrefix} City A ${suffix}`,
    province: "Zhejiang",
    countryId: china.id,
    isActive: true,
    verified: true,
  });
  const cityB = await createReferenceData(admin, "cities", {
    slug: `module4-city-b-${suffix}`,
    name: `${namePrefix} City B ${suffix}`,
    province: "Zhejiang",
    countryId: china.id,
    isActive: true,
    verified: true,
  });
  const universityA = await createReferenceData(admin, "universities", {
    slug: `module4-university-a-${suffix}`,
    name: `${namePrefix} University A ${suffix}`,
    shortName: "M4A",
    cityId: cityA.id,
    isActive: true,
    verified: true,
  });
  const universityB = await createReferenceData(admin, "universities", {
    slug: `module4-university-b-${suffix}`,
    name: `${namePrefix} University B ${suffix}`,
    shortName: "M4B",
    cityId: cityB.id,
    isActive: true,
    verified: true,
  });
  const memberCitySwitch = await prisma.user.create({
    data: {
      email: `member-city-switch-${suffix}@${testDomain}`,
      firstName: "Module4",
      lastName: "CitySwitch",
      role: "MEMBER",
      status: "ACTIVE",
      countryId: origin.id,
      cityId: cityA.id,
      universityId: universityA.id,
      onboardingCompletedAt: new Date(),
    },
  });
  return {
    admin,
    member,
    memberDraftOnly,
    memberCitySwitch,
    origin,
    cityA,
    cityB,
    universityA,
    universityB,
    suffix,
  };
}

postgresDescribe("Module 4 PostgreSQL reference data and onboarding", () => {
  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module4_fail_reference_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module4_fail_reference_audit"()',
    );
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "module4_fail_reference_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION IF EXISTS "module4_fail_reference_audit"()',
    );
    await cleanup();
    await prisma.$disconnect();
  });

  it("saves a resumable draft and completes onboarding atomically", async () => {
    const references = {
      countryId: fixture.origin.id,
      cityId: fixture.cityA.id,
      universityId: fixture.universityA.id,
    };
    const draft = await saveOnboardingDraft(fixture.member.id, {
      ...references,
      degree: "",
      studyLevel: "MASTERS",
      arrivalDate: new Date("2026-09-01"),
      languages: ["English"],
      interests: [],
    });
    expect(draft.onboardingCompletedAt).toBeNull();
    expect(draft.cityId).toBe(fixture.cityA.id);

    const completed = await completeOnboarding(
      fixture.member.id,
      {
        ...references,
        degree: "International Business",
        studyLevel: "MASTERS",
        arrivalDate: new Date("2026-09-01"),
        languages: ["English", "French"],
        interests: ["Community", "Internship"],
      },
      { ipAddress: "203.0.113.10", userAgent: "Module 4 test" },
    );
    expect(completed.onboardingCompletedAt).toEqual(expect.any(String));
    await expect(
      prisma.auditLog.findFirst({
        where: {
          actorId: fixture.member.id,
          action: "ONBOARDING_COMPLETED",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("saves a step-0 draft with only a country of origin selected", async () => {
    // Regression test: the onboarding wizard PATCHes a draft after every
    // step, so the very first save only has countryId — city/university are
    // chosen later. This must persist the country without requiring the
    // still-unselected city/university references.
    const draft = await saveOnboardingDraft(fixture.memberDraftOnly.id, {
      countryId: fixture.origin.id,
    });
    expect(draft.countryId).toBe(fixture.origin.id);
    expect(draft.cityId).toBeNull();
    expect(draft.universityId).toBeNull();
    expect(draft.onboardingCompletedAt).toBeNull();

    const withCity = await saveOnboardingDraft(fixture.memberDraftOnly.id, {
      countryId: fixture.origin.id,
      cityId: fixture.cityA.id,
      universityId: fixture.universityA.id,
    });
    expect(withCity.cityId).toBe(fixture.cityA.id);
    expect(withCity.universityId).toBe(fixture.universityA.id);
  });

  it("clears a stale university when a member changes city without resending it", async () => {
    // Regression test: a member who already completed onboarding with
    // cityA/universityA switches to cityB in one draft save without also
    // resending universityId (e.g. before picking a new one). The DB has a
    // trigger that rejects a User row where cityId and the linked
    // university's cityId disagree, so the draft save must clear the now-
    // mismatched university itself rather than leaving it dangling or
    // throwing a raw database error.
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.memberCitySwitch.id },
      select: { cityId: true, universityId: true },
    });
    expect(before.cityId).toBe(fixture.cityA.id);
    expect(before.universityId).toBe(fixture.universityA.id);

    const draft = await saveOnboardingDraft(fixture.memberCitySwitch.id, {
      cityId: fixture.cityB.id,
    });
    expect(draft.cityId).toBe(fixture.cityB.id);
    expect(draft.universityId).toBeNull();

    const withNewUniversity = await saveOnboardingDraft(
      fixture.memberCitySwitch.id,
      { cityId: fixture.cityB.id, universityId: fixture.universityB.id },
    );
    expect(withNewUniversity.cityId).toBe(fixture.cityB.id);
    expect(withNewUniversity.universityId).toBe(fixture.universityB.id);
  });

  it("rejects mismatched, inactive, or unverified universities without changing the user", async () => {
    const before = await prisma.user.findUniqueOrThrow({
      where: { id: fixture.member.id },
      select: { cityId: true, universityId: true },
    });
    await expect(
      validateOnboardingReferences({
        countryId: fixture.origin.id,
        cityId: fixture.cityA.id,
        universityId: fixture.universityB.id,
      }),
    ).rejects.toBeInstanceOf(ReferenceDataError);

    await updateReferenceData(
      fixture.admin,
      "universities",
      fixture.universityB.id,
      { isActive: false },
    );
    await expect(
      validateOnboardingReferences({
        countryId: fixture.origin.id,
        cityId: fixture.cityB.id,
        universityId: fixture.universityB.id,
      }),
    ).rejects.toBeInstanceOf(ReferenceDataError);
    await updateReferenceData(
      fixture.admin,
      "universities",
      fixture.universityB.id,
      { isActive: true, verified: false },
    );
    await expect(
      validateOnboardingReferences({
        countryId: fixture.origin.id,
        cityId: fixture.cityB.id,
        universityId: fixture.universityB.id,
      }),
    ).rejects.toBeInstanceOf(ReferenceDataError);
    await updateReferenceData(
      fixture.admin,
      "universities",
      fixture.universityB.id,
      { verified: true },
    );

    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.member.id },
        select: { cityId: true, universityId: true },
      }),
    ).resolves.toEqual(before);
  });

  it("enforces database location consistency and synchronizes university moves", async () => {
    await expect(
      prisma.university.create({
        data: {
          slug: `module4-invalid-${fixture.suffix}`,
          name: `${namePrefix} Invalid University ${fixture.suffix}`,
          countryId: fixture.origin.id,
          cityId: fixture.cityA.id,
          isActive: true,
          verified: true,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.user.update({
        where: { id: fixture.member.id },
        data: { cityId: fixture.cityB.id },
      }),
    ).rejects.toThrow();

    await updateReferenceData(
      fixture.admin,
      "universities",
      fixture.universityA.id,
      { cityId: fixture.cityB.id },
    );
    await expect(
      prisma.user.findUniqueOrThrow({
        where: { id: fixture.member.id },
        select: { cityId: true },
      }),
    ).resolves.toEqual({ cityId: fixture.cityB.id });
  });

  it("lists safe lifecycle data and protects referenced deletion", async () => {
    const listed = await listReferenceData(fixture.admin, "universities", {
      query: fixture.suffix,
    });
    expect(listed.records.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(listed)).not.toContain("passwordHash");

    const onboarding = await getOnboardingReferenceData();
    expect(
      onboarding.universities.some(
        (university) => university.id === fixture.universityA.id,
      ),
    ).toBe(true);

    await expect(
      deleteReferenceData(
        fixture.admin,
        "universities",
        fixture.universityA.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("supports audited create, update, and dependency-safe delete for every reference type", async () => {
    const country = await createReferenceData(fixture.admin, "countries", {
      code: await unusedCountryCode(),
      name: `${namePrefix} Disposable Country ${fixture.suffix}`,
      emoji: null,
      isActive: true,
      verified: false,
    });
    const city = await createReferenceData(fixture.admin, "cities", {
      slug: `module4-disposable-city-${fixture.suffix}`,
      name: `${namePrefix} Disposable City ${fixture.suffix}`,
      province: null,
      countryId: country.id,
      isActive: true,
      verified: false,
    });
    const university = await createReferenceData(
      fixture.admin,
      "universities",
      {
        slug: `module4-disposable-university-${fixture.suffix}`,
        name: `${namePrefix} Disposable University ${fixture.suffix}`,
        shortName: null,
        cityId: city.id,
        isActive: true,
        verified: false,
      },
    );
    await updateReferenceData(fixture.admin, "countries", country.id, {
      verified: true,
    });
    await deleteReferenceData(fixture.admin, "universities", university.id);
    await deleteReferenceData(fixture.admin, "cities", city.id);
    await deleteReferenceData(fixture.admin, "countries", country.id);

    const auditCount = await prisma.auditLog.count({
      where: {
        actorId: fixture.admin.id,
        entityId: { in: [country.id, city.id, university.id] },
      },
    });
    expect(auditCount).toBe(7);
  });

  it("rolls back a reference mutation when its mandatory audit fails", async () => {
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "module4_fail_reference_audit"()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."action" = 'REFERENCE_COUNTRY_CREATED' THEN
          RAISE EXCEPTION 'module4 audit unavailable';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "module4_fail_reference_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW
      EXECUTE FUNCTION "module4_fail_reference_audit"()
    `);
    const name = `${namePrefix} Rollback Country ${fixture.suffix}`;
    await expect(
      createReferenceData(fixture.admin, "countries", {
        code: await unusedCountryCode(),
        name,
        emoji: null,
        isActive: true,
        verified: false,
      }),
    ).rejects.toThrow();
    await expect(
      prisma.country.findUnique({ where: { name } }),
    ).resolves.toBeNull();

    await prisma.$executeRawUnsafe(
      'DROP TRIGGER "module4_fail_reference_audit_trigger" ON "AuditLog"',
    );
    await prisma.$executeRawUnsafe(
      'DROP FUNCTION "module4_fail_reference_audit"()',
    );
  });
});
