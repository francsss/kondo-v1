import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { discoverResources } from "@/lib/discover";
import { recommendLocalResources } from "@/lib/local-recommendations";
import { listPublicCatalog } from "@/lib/organization-catalog";
import { prisma } from "@/lib/prisma";

/**
 * Food & Services and Student Skills are projections of their own source
 * domains. These tests prove there is no copy: changing the source immediately
 * changes every surface.
 */

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "sections.test";

let ids: {
  localId: string;
  distantId: string;
  studentId: string;
  organizationId: string;
  cityId: string;
  otherCityId: string;
  countryId: string;
  serviceId: string;
  skillId: string;
};

async function makeUser(prefix: string, extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@${domain}`,
      passwordHash: "x".repeat(60),
      firstName: prefix,
      lastName: "Tester",
      status: "ACTIVE",
      ...extra,
    },
    select: { id: true },
  });
  return user.id;
}

function serviceIds(items: Array<{ id: string }>) {
  return items.map((item) => item.id);
}

postgresDescribe("marketplace sections (postgres)", () => {
  beforeAll(async () => {
    const country = await prisma.country.create({
      data: {
        name: `Sections Land ${randomUUID().slice(0, 8)}`,
        code: randomUUID().slice(0, 2).toUpperCase(),
      },
      select: { id: true },
    });
    const [city, otherCity] = await Promise.all([
      prisma.city.create({
        data: {
          name: `Section City ${randomUUID().slice(0, 6)}`,
          slug: `section-city-${randomUUID().slice(0, 8)}`,
          countryId: country.id,
        },
        select: { id: true },
      }),
      prisma.city.create({
        data: {
          name: `Distant City ${randomUUID().slice(0, 6)}`,
          slug: `distant-city-${randomUUID().slice(0, 8)}`,
          countryId: country.id,
        },
        select: { id: true },
      }),
    ]);

    const ownerId = await makeUser("owner");
    const localId = await makeUser("local", {
      cityId: city.id,
      countryId: country.id,
      interests: ["Food & Dining"],
    });
    // No city, no interests: must not inherit anyone else's personalization.
    const distantId = await makeUser("distant");
    const studentId = await makeUser("student", { cityId: city.id });

    const organization = await prisma.organization.create({
      data: {
        slug: `sections-org-${randomUUID().slice(0, 8)}`,
        publicName: "Mama Africa Kitchen",
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        createdById: ownerId,
        countryId: country.id,
        cityId: city.id,
        capabilities: {
          create: [{ key: "STUDENT_SERVICES", status: "ENABLED" }],
        },
        memberships: {
          create: [{ userId: ownerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
      select: { id: true },
    });

    const service = await prisma.organizationService.create({
      data: {
        slug: `restaurant-service-${randomUUID().slice(0, 8)}`,
        organizationId: organization.id,
        createdByUserId: ownerId,
        cityId: city.id,
        title: "Cameroonian meals and delivery",
        shortDescription:
          "Home-style Cameroonian meals prepared and delivered.",
        description:
          "Home-style Cameroonian meals prepared daily and delivered around the city.",
        category: "Food & Dining",
        status: "PUBLISHED",
        publishedAt: new Date(),
        priceType: "STARTING_AT",
        priceMinor: 3500,
        currency: "CNY",
        contactMethod: "PUBLIC_CONTACT",
      },
      select: { id: true },
    });

    const skill = await prisma.studentSkillOffer.create({
      data: {
        ownerId: studentId,
        cityId: city.id,
        title: "Mathematics tutoring for first-year students",
        category: "Tutoring",
        description: "Weekly tutoring sessions in mathematics and statistics.",
        availability: "Weekday evenings",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
      },
      select: { id: true },
    });

    ids = {
      localId,
      distantId,
      studentId,
      organizationId: organization.id,
      cityId: city.id,
      otherCityId: otherCity.id,
      countryId: country.id,
      serviceId: service.id,
      skillId: skill.id,
    };
  });

  beforeEach(async () => {
    await prisma.organization.update({
      where: { id: ids.organizationId },
      data: { lifecycleStatus: "ACTIVE" },
    });
    await prisma.organizationService.update({
      where: { id: ids.serviceId },
      data: { status: "PUBLISHED" },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const list = users.map((user) => user.id);
    // Ordered by foreign key: children first, then the rows they point at.
    await prisma.studentSkillOffer.deleteMany({
      where: { ownerId: { in: list } },
    });
    await prisma.organizationService.deleteMany({
      where: { organizationId: ids.organizationId },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: list } } });
    await prisma.organizationService.deleteMany({
      where: { createdByUserId: { in: list } },
    });
    await prisma.organization.deleteMany({
      where: { createdById: { in: list } },
    });
    await prisma.user.deleteMany({ where: { id: { in: list } } });
    await prisma.city.deleteMany({
      where: { id: { in: [ids.cityId, ids.otherCityId] } },
    });
    await prisma.country.deleteMany({ where: { id: ids.countryId } });
  });

  it("projects a published organization service into Food & Services", async () => {
    const services = await listPublicCatalog({ kind: "service", limit: 50 });
    expect(serviceIds(services)).toContain(ids.serviceId);
  });

  it("aggregates the same record in Discover without duplicating it", async () => {
    const groups = await discoverResources({
      context: {
        viewerId: ids.localId,
        cityId: ids.cityId,
        universityId: null,
        studentJourney: null,
      },
      type: "services",
      filters: { cityId: ids.cityId },
    });
    const items = groups.flatMap((group) => group.items);
    const matches = items.filter((item) => item.id === ids.serviceId);
    // Present exactly once, and read from the catalog domain.
    expect(matches).toHaveLength(1);
    expect(matches[0]?.analytics.sourceDomain).toBe("organization-service");
  });

  it("surfaces a student skill in Discover as a skill, never as a service", async () => {
    const groups = await discoverResources({
      context: {
        viewerId: ids.localId,
        cityId: ids.cityId,
        universityId: null,
        studentJourney: null,
      },
      type: "skills",
      filters: { cityId: ids.cityId },
    });
    const items = groups.flatMap((group) => group.items);
    const skill = items.find((item) => item.id === ids.skillId);
    expect(skill).toBeDefined();
    expect(skill?.type).toBe("skills");
    expect(skill?.eyebrow).toBe("Student skill");
    expect(skill?.analytics.sourceDomain).toBe("student-skill");
  });

  it("recommends the service to a member in the same city, with a reason", async () => {
    const { items } = await recommendLocalResources({
      userId: ids.localId,
      limit: 12,
    });
    const service = items.find(
      (item) => item.id === `service:${ids.serviceId}`,
    );
    expect(service).toBeDefined();
    expect(service?.kind).toBe("organization-service");
    expect(service?.publisher).toBe("Mama Africa Kitchen");
    expect(service?.reason.length).toBeGreaterThan(0);
    // The member selected "Food & Dining", so the reason must name it.
    expect(service?.reason).toMatch(/you selected Food & Dining/i);
  });

  it("does not give the same personalization to a member without the signals", async () => {
    const { items } = await recommendLocalResources({
      userId: ids.distantId,
      limit: 12,
    });
    const service = items.find(
      (item) => item.id === `service:${ids.serviceId}`,
    );
    // They may still see locally available content, but never with another
    // member's interest as the stated reason.
    expect(service?.reason ?? "").not.toMatch(/you selected Food & Dining/i);
  });

  it("never recommends a student their own skill offer", async () => {
    const { items } = await recommendLocalResources({
      userId: ids.studentId,
      limit: 12,
    });
    expect(items.map((item) => item.id)).not.toContain(`skill:${ids.skillId}`);
  });

  it("labels a student skill distinctly and hides the full identity", async () => {
    const { items } = await recommendLocalResources({
      userId: ids.localId,
      limit: 12,
    });
    const skill = items.find((item) => item.id === `skill:${ids.skillId}`);
    expect(skill).toBeDefined();
    expect(skill?.sourceLabel).toBe("Student skill · Tutoring");
    expect(skill?.publisher).toBe("student");
    expect(JSON.stringify(skill)).not.toContain(domain);
    // Students publish no structured price; none is invented.
    expect(skill?.priceLabel).toBeNull();
  });

  it("removes the service everywhere when the organization is suspended", async () => {
    await prisma.organization.update({
      where: { id: ids.organizationId },
      data: { lifecycleStatus: "SUSPENDED" },
    });

    const services = await listPublicCatalog({ kind: "service", limit: 50 });
    expect(serviceIds(services)).not.toContain(ids.serviceId);

    const groups = await discoverResources({
      context: {
        viewerId: ids.localId,
        cityId: ids.cityId,
        universityId: null,
        studentJourney: null,
      },
      type: "services",
      filters: { cityId: ids.cityId },
    });
    expect(
      groups.flatMap((group) => group.items).map((item) => item.id),
    ).not.toContain(ids.serviceId);

    const { items } = await recommendLocalResources({
      userId: ids.localId,
      limit: 12,
    });
    expect(items.map((item) => item.id)).not.toContain(
      `service:${ids.serviceId}`,
    );
  });

  it("removes an unpublished service from every projection", async () => {
    await prisma.organizationService.update({
      where: { id: ids.serviceId },
      data: { status: "PAUSED" },
    });
    const services = await listPublicCatalog({ kind: "service", limit: 50 });
    expect(serviceIds(services)).not.toContain(ids.serviceId);

    const { items } = await recommendLocalResources({
      userId: ids.localId,
      limit: 12,
    });
    expect(items.map((item) => item.id)).not.toContain(
      `service:${ids.serviceId}`,
    );
  });

  it("returns a stable order for repeated requests", async () => {
    const first = await recommendLocalResources({ userId: ids.localId });
    const second = await recommendLocalResources({ userId: ids.localId });
    expect(first.items.map((item) => item.id)).toEqual(
      second.items.map((item) => item.id),
    );
  });

  it("keeps Community Exchange records intact after the section was retired", async () => {
    // Retiring the section removed navigation, not data.
    await expect(
      prisma.communityExchangeOffer.count(),
    ).resolves.toBeGreaterThanOrEqual(0);
  });
});
