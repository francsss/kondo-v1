import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CityHubError,
  createCityHubEntry,
  createCityHub,
  deleteCityHubEntry,
  deleteCityHub,
  getAdminCityHub,
  resolvePublishedCity,
  setCityHubStatus,
  unpublishCityHub,
  updateCityHubDetails,
  updateCityHubEntry,
  updateCityHubSection,
} from "@/lib/city-hub";
import { prisma } from "@/lib/prisma";
import type { ExploreCity } from "@/features/explore/types";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "module20.test";
const CITY_SLUG = "jiaxing";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  await prisma.cityHub.deleteMany({ where: { createdById: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const [admin, moderator, member] = await Promise.all(
    [
      ["admin", "ADMIN"],
      ["moderator", "MODERATOR"],
      ["member", "MEMBER"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          username: `${label}${suffix.slice(0, 8)}`,
          firstName: label![0]!.toUpperCase() + label!.slice(1),
          lastName: "City20",
          role: role as "ADMIN" | "MODERATOR" | "MEMBER",
          status: "ACTIVE",
        },
      }),
    ),
  );
  return { admin, moderator, member };
}

async function createDraftHub() {
  const { hub } = await createCityHub({
    actor: fixture.admin,
    data: { slug: CITY_SLUG, name: "Jiaxing", seedFromRegistry: true },
  });
  return hub.id;
}

function cityDetails(city: ExploreCity) {
  return {
    slug: city.slug,
    name: city.name,
    province: city.province,
    country: city.country,
    eyebrow: city.eyebrow,
    title: city.title,
    tagline: city.tagline,
    summary: city.summary,
    description: city.description,
    signals: city.signals,
    impactPoints: city.impactPoints,
  };
}

postgresDescribe("Module 20 PostgreSQL city hub editorial", () => {
  beforeAll(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  beforeEach(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("seeds a draft from the registry and audits creation", async () => {
    const hubId = await createDraftHub();
    const hub = await getAdminCityHub(fixture.admin, hubId);
    expect(hub?.status).toBe("DRAFT");
    expect((hub?.draft as unknown as ExploreCity).slug).toBe(CITY_SLUG);
    expect(
      (hub?.draft as unknown as ExploreCity).sections.length,
    ).toBeGreaterThan(0);
    await expect(
      prisma.auditLog.count({
        where: { action: "CITY_HUB_CREATED", entityId: hubId },
      }),
    ).resolves.toBe(1);
  });

  it("runs the full draft -> review -> published lifecycle and serves published content publicly", async () => {
    const hubId = await createDraftHub();
    // Not visible publicly while unpublished.
    await expect(resolvePublishedCity(CITY_SLUG)).resolves.toBeNull();

    const reviewed = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "REVIEW",
      expectedVersion: 1,
    });
    expect(reviewed.hub.status).toBe("REVIEW");

    const published = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "PUBLISHED",
      expectedVersion: reviewed.hub.version,
    });
    expect(published.hub.status).toBe("PUBLISHED");
    expect(published.hub.publishedAt).not.toBeNull();

    const publicCity = await resolvePublishedCity(CITY_SLUG);
    expect(publicCity?.slug).toBe(CITY_SLUG);
    expect(publicCity?.name).toBe("Jiaxing");
    await expect(
      prisma.auditLog.count({
        where: { action: "CITY_HUB_PUBLISHED", entityId: hubId },
      }),
    ).resolves.toBe(1);
  });

  it("blocks direct DRAFT -> PUBLISHED transitions", async () => {
    const hubId = await createDraftHub();
    await expect(
      setCityHubStatus({
        actor: fixture.admin,
        hubId,
        status: "PUBLISHED",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("unpublishes the public snapshot without deleting the editable draft", async () => {
    const hubId = await createDraftHub();
    const reviewed = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "REVIEW",
      expectedVersion: 1,
    });
    const published = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "PUBLISHED",
      expectedVersion: reviewed.hub.version,
    });
    await expect(
      unpublishCityHub({
        actor: fixture.admin,
        hubId,
        expectedVersion: published.hub.version,
      }),
    ).resolves.toMatchObject({ status: "DRAFT" });
    await expect(resolvePublishedCity(CITY_SLUG)).resolves.toBeNull();
    await expect(
      prisma.cityHub.findUniqueOrThrow({
        where: { id: hubId },
        select: { draft: true, published: true, publishedAt: true },
      }),
    ).resolves.toMatchObject({
      draft: expect.any(Object),
      published: null,
      publishedAt: null,
    });
    await expect(
      prisma.auditLog.count({
        where: { action: "CITY_HUB_UNPUBLISHED", entityId: hubId },
      }),
    ).resolves.toBe(1);
  });

  it("refuses draft edits unless the hub is in DRAFT, then allows edit after revert while keeping the published snapshot live", async () => {
    const hubId = await createDraftHub();
    const seeded = await getAdminCityHub(fixture.admin, hubId);
    const payload = seeded!.draft as unknown as ExploreCity;

    // Publish first.
    const reviewed = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "REVIEW",
      expectedVersion: seeded!.version,
    });
    const published = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "PUBLISHED",
      expectedVersion: reviewed.hub.version,
    });

    // Editing is refused while PUBLISHED.
    await expect(
      updateCityHubDetails({
        actor: fixture.admin,
        hubId,
        data: {
          payload: { ...cityDetails(payload), tagline: "Revised tagline" },
          expectedVersion: published.hub.version,
        },
      }),
    ).rejects.toBeInstanceOf(CityHubError);

    // Revert to draft; live published snapshot is preserved.
    const reverted = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "DRAFT",
      expectedVersion: published.hub.version,
    });
    const stillLive = await resolvePublishedCity(CITY_SLUG);
    expect(stillLive?.tagline).toBe(payload.tagline);

    // Now the edit is accepted.
    await updateCityHubDetails({
      actor: fixture.admin,
      hubId,
      data: {
        payload: { ...cityDetails(payload), tagline: "Revised tagline" },
        expectedVersion: reverted.hub.version,
      },
    });
    const afterEdit = await getAdminCityHub(fixture.admin, hubId);
    expect((afterEdit!.draft as unknown as ExploreCity).tagline).toBe(
      "Revised tagline",
    );
    // Public still shows the previously published tagline until re-publish.
    const live = await resolvePublishedCity(CITY_SLUG);
    expect(live?.tagline).toBe(payload.tagline);
  });

  it("enforces optimistic concurrency on status transitions", async () => {
    const hubId = await createDraftHub();
    await expect(
      setCityHubStatus({
        actor: fixture.admin,
        hubId,
        status: "REVIEW",
        expectedVersion: 999,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("creates, reloads, edits, publishes, and deletes one entry without modifying other sections", async () => {
    const hubId = await createDraftHub();
    const initial = await getAdminCityHub(fixture.admin, hubId);
    const initialDraft = initial!.draft as unknown as ExploreCity;
    const companiesBefore = structuredClone(
      initialDraft.sections.find((section) => section.slug === "companies"),
    );
    const jobsBefore = initialDraft.sections.find(
      (section) => section.slug === "jobs",
    )!;
    const entry = {
      id: `independent-${randomUUID()}`,
      slug: `independent-internship-${randomUUID()}`,
      type: "opportunity" as const,
      title: "Independent internship",
      category: "Internship",
      summary: "A test internship saved without editing another section.",
      location: "Jiaxing",
      status: "Applications open",
      tags: ["Internship"],
      details: ["Independent persistence test"],
    };

    const created = await createCityHubEntry({
      actor: fixture.admin,
      hubId,
      sectionSlug: "jobs",
      data: { payload: entry, expectedVersion: initial!.version },
    });

    // A fresh database read represents the post-refresh state.
    const afterCreate = await getAdminCityHub(fixture.admin, hubId);
    const createdDraft = afterCreate!.draft as unknown as ExploreCity;
    expect(
      createdDraft.sections
        .find((section) => section.slug === "jobs")
        ?.entries.some((candidate) => candidate.id === entry.id),
    ).toBe(true);
    expect(
      createdDraft.sections.find((section) => section.slug === "companies"),
    ).toEqual(companiesBefore);

    const sectionPayload = {
      slug: jobsBefore.slug,
      title: "Jobs & Internships in Jiaxing",
      shortTitle: jobsBefore.shortTitle,
      eyebrow: jobsBefore.eyebrow,
      summary: jobsBefore.summary,
      description: jobsBefore.description,
      icon: jobsBefore.icon,
      accent: jobsBefore.accent,
      signal: jobsBefore.signal,
      studentValue: jobsBefore.studentValue,
      cityValue: jobsBefore.cityValue,
    };
    const sectionUpdated = await updateCityHubSection({
      actor: fixture.admin,
      hubId,
      sectionSlug: "jobs",
      data: {
        payload: sectionPayload,
        expectedVersion: created.hub.version,
      },
    });
    const afterSectionUpdate = await getAdminCityHub(fixture.admin, hubId);
    const sectionDraft = afterSectionUpdate!.draft as unknown as ExploreCity;
    expect(
      sectionDraft.sections
        .find((section) => section.slug === "jobs")
        ?.entries.some((candidate) => candidate.id === entry.id),
    ).toBe(true);
    expect(
      sectionDraft.sections.find((section) => section.slug === "companies"),
    ).toEqual(companiesBefore);

    const entryUpdated = await updateCityHubEntry({
      actor: fixture.admin,
      hubId,
      sectionSlug: "jobs",
      entryId: entry.id,
      data: {
        payload: { ...entry, title: "Updated independent internship" },
        expectedVersion: sectionUpdated.hub.version,
      },
    });
    const afterEntryUpdate = await getAdminCityHub(fixture.admin, hubId);
    const updatedDraft = afterEntryUpdate!.draft as unknown as ExploreCity;
    expect(
      updatedDraft.sections
        .find((section) => section.slug === "jobs")
        ?.entries.find((candidate) => candidate.id === entry.id)?.title,
    ).toBe("Updated independent internship");
    expect(
      updatedDraft.sections.find((section) => section.slug === "companies"),
    ).toEqual(companiesBefore);

    const reviewed = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "REVIEW",
      expectedVersion: entryUpdated.hub.version,
    });
    await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "PUBLISHED",
      expectedVersion: reviewed.hub.version,
    });
    const publicCity = await resolvePublishedCity(CITY_SLUG);
    expect(
      publicCity?.sections
        .find((section) => section.slug === "jobs")
        ?.entries.find((candidate) => candidate.id === entry.id)?.title,
    ).toBe("Updated independent internship");

    const reverted = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "DRAFT",
      expectedVersion: reviewed.hub.version + 1,
    });
    await deleteCityHubEntry({
      actor: fixture.admin,
      hubId,
      sectionSlug: "jobs",
      entryId: entry.id,
      expectedVersion: reverted.hub.version,
    });
    const afterDelete = await getAdminCityHub(fixture.admin, hubId);
    const deletedDraft = afterDelete!.draft as unknown as ExploreCity;
    expect(
      deletedDraft.sections
        .find((section) => section.slug === "jobs")
        ?.entries.some((candidate) => candidate.id === entry.id),
    ).toBe(false);
    expect(
      deletedDraft.sections.find((section) => section.slug === "companies"),
    ).toEqual(companiesBefore);
    // The last published snapshot remains live until the hub is published again.
    expect(
      (await resolvePublishedCity(CITY_SLUG))?.sections
        .find((section) => section.slug === "jobs")
        ?.entries.some((candidate) => candidate.id === entry.id),
    ).toBe(true);
  });

  it("denies create and publish to non-admin roles", async () => {
    await expect(
      createCityHub({
        actor: fixture.member,
        data: { slug: "other-city", name: "Other" },
      }),
    ).rejects.toMatchObject({ status: 403 });

    const hubId = await createDraftHub();
    await expect(
      setCityHubStatus({
        actor: fixture.moderator,
        hubId,
        status: "REVIEW",
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("blocks deletion while any public snapshot exists but allows deleting a draft-only hub", async () => {
    const hubId = await createDraftHub();
    const reviewed = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "REVIEW",
      expectedVersion: 1,
    });
    const published = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "PUBLISHED",
      expectedVersion: reviewed.hub.version,
    });
    await expect(
      deleteCityHub({ actor: fixture.admin, hubId }),
    ).rejects.toMatchObject({ status: 409 });
    const revised = await setCityHubStatus({
      actor: fixture.admin,
      hubId,
      status: "DRAFT",
      expectedVersion: published.hub.version,
    });
    await expect(
      deleteCityHub({ actor: fixture.admin, hubId }),
    ).rejects.toMatchObject({ status: 409 });
    await unpublishCityHub({
      actor: fixture.admin,
      hubId,
      expectedVersion: revised.hub.version,
    });
    await expect(
      deleteCityHub({ actor: fixture.admin, hubId }),
    ).resolves.toMatchObject({ deleted: true });

    // A fresh draft hub can be deleted.
    const { hub: draftHub } = await createCityHub({
      actor: fixture.admin,
      data: { slug: "draft-only", name: "Draft Only" },
    });
    await expect(
      deleteCityHub({ actor: fixture.admin, hubId: draftHub.id }),
    ).resolves.toMatchObject({ deleted: true });
  });
});
