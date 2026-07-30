import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  getAdminOrganization,
  updateOrganizationLifecycleAsAdmin,
} from "@/lib/organization-admin";
import {
  addOrganizationGalleryMedia,
  removeOrganizationGalleryMedia,
} from "@/lib/organization-public-media";
import { moderateOrganizationPublicProfile } from "@/lib/organization-public-moderation";
import {
  getOrganizationPublicProfile,
  listPublicOrganizations,
  updateOrganizationPublicProfile,
} from "@/lib/organization-public-profile";
import {
  publishOrganizationPublicProfile,
  unpublishOrganizationPublicProfile,
} from "@/lib/organization-publication";
import { createOrReuseOrganizationReport } from "@/lib/organization-reporting";
import { updateOrganizationProfile } from "@/lib/organization-profile-service";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "organization-public-profile.test";

type Fixture = Awaited<ReturnType<typeof createFixture>>;
let fixture: Fixture;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${testDomain}` } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const organizations = await prisma.organization.findMany({
    where: { createdById: { in: userIds } },
    select: { id: true },
  });
  const organizationIds = organizations.map(({ id }) => id);
  await prisma.report.deleteMany({
    where: { targetType: "Organization", targetId: { in: organizationIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.notification.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.notificationJob.deleteMany({
    where: { recipientId: { in: userIds } },
  });
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { organizationId: { in: organizationIds } },
      ],
    },
  });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function createFixture() {
  const suffix = randomUUID().replaceAll("-", "");
  const country = await prisma.country.upsert({
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
  const city = await prisma.city.upsert({
    where: { slug: `public-profile-city-${suffix.slice(0, 10)}` },
    update: {},
    create: {
      slug: `public-profile-city-${suffix.slice(0, 10)}`,
      name: `Public City ${suffix.slice(0, 5)}`,
      countryId: country.id,
      isActive: true,
      verified: true,
    },
  });
  const [owner, editor, viewer, outsider, platformAdmin] = await Promise.all(
    [
      ["owner", "MEMBER"],
      ["editor", "MEMBER"],
      ["viewer", "MEMBER"],
      ["outsider", "MEMBER"],
      ["platform-admin", "ADMIN"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          firstName: label!,
          lastName: "Public Profile",
          role: role as "MEMBER" | "ADMIN",
          status: "ACTIVE",
        },
      }),
    ),
  );
  const organization = await prisma.organization.create({
    data: {
      publicName: `Public Network ${suffix.slice(0, 7)}`,
      legalName: `Private Legal Identity ${suffix}`,
      slug: `public-network-${suffix.slice(0, 12)}`,
      type: "SERVICE_PROVIDER",
      countryId: country.id,
      cityId: city.id,
      lifecycleStatus: "ACTIVE",
      setupCompletedAt: new Date(),
      createdById: owner.id,
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER", status: "ACTIVE" },
          { userId: editor.id, role: "EDITOR", status: "ACTIVE" },
          { userId: viewer.id, role: "VIEWER", status: "ACTIVE" },
        ],
      },
      capabilities: {
        create: [{ key: "STUDENT_SERVICES", status: "ENABLED" }],
      },
    },
  });
  return {
    suffix,
    country,
    city,
    owner,
    editor,
    viewer,
    outsider,
    platformAdmin,
    organization,
  };
}

async function prepareAndPublish() {
  const update = await updateOrganizationPublicProfile(
    fixture.owner,
    fixture.organization.id,
    {
      tagline: "Practical student support",
      shortDescription:
        "A public organization profile created for integration testing.",
      extendedDescription: "Only explicitly public presentation is serialized.",
      publicAddress: "City center",
      serviceAreas: ["Student services"],
      supportedLanguages: ["English"],
      representationConfirmed: true,
      contacts: [
        {
          type: "WEBSITE",
          label: "Official website",
          value: "https://example.org/public",
          visibility: "PUBLIC",
        },
        {
          type: "EMAIL",
          label: "Internal operations",
          value: "private-operations@example.org",
          visibility: "PRIVATE",
        },
      ],
    },
  );
  expect(update.publicProfileStatus).toBe("READY");
  return publishOrganizationPublicProfile(
    fixture.owner,
    fixture.organization.id,
  );
}

postgresDescribe("public organization profiles", () => {
  beforeEach(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("publishes only through server readiness and excludes every private field", async () => {
    await expect(
      publishOrganizationPublicProfile(fixture.owner, fixture.organization.id),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateOrganizationPublicProfile(fixture.viewer, fixture.organization.id, {
        tagline: "Unauthorized",
        shortDescription: "Viewer access must not edit a public profile.",
        extendedDescription: "",
        publicAddress: "",
        serviceAreas: [],
        supportedLanguages: [],
        representationConfirmed: true,
        contacts: [],
      }),
    ).rejects.toMatchObject({ status: 403 });

    await prepareAndPublish();
    const result = await getOrganizationPublicProfile(
      fixture.organization.slug,
    );
    expect(result?.profile.publicName).toBe(fixture.organization.publicName);
    expect(result?.profile.publicContactChannels).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(
      fixture.organization.legalName,
    );
    expect(JSON.stringify(result)).not.toContain(
      "private-operations@example.org",
    );
    expect(JSON.stringify(result)).not.toContain("memberships");
    expect(JSON.stringify(result)).not.toContain("verificationRequests");

    await expect(
      publishOrganizationPublicProfile(fixture.editor, fixture.organization.id),
    ).rejects.toMatchObject({ status: 403 });
    await unpublishOrganizationPublicProfile(
      fixture.owner,
      fixture.organization.id,
    );
    await expect(
      getOrganizationPublicProfile(fixture.organization.slug),
    ).resolves.toBeNull();
  });

  it("keeps directory, city, capability, trust and legal-name filtering safe", async () => {
    await prepareAndPublish();
    await prisma.organization.update({
      where: { id: fixture.organization.id },
      data: { verificationStatus: "VERIFIED" },
    });
    const result = await listPublicOrganizations({
      type: "SERVICE_PROVIDER",
      capability: "STUDENT_SERVICES",
      cityId: fixture.city.id,
      verification: "VERIFIED",
    });
    expect(result.total).toBe(1);
    expect(result.organizations[0]).toMatchObject({
      id: fixture.organization.id,
      trust: { verification: { state: "VERIFIED" } },
    });
    const legalNameResult = await listPublicOrganizations({
      query: fixture.organization.legalName!,
    });
    expect(legalNameResult.total).toBe(0);
    expect(result.organizations.length).toBeLessThanOrEqual(result.pageSize);

    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "SUSPENDED",
        reason: "Integration test verifies public visibility override.",
      },
    );
    await expect(
      getOrganizationPublicProfile(fixture.organization.slug),
    ).resolves.toBeNull();
    expect(
      (
        await listPublicOrganizations({
          cityId: fixture.city.id,
        })
      ).organizations,
    ).toEqual([]);
  });

  it("preserves old public URLs with safe aliases and canonical destination", async () => {
    await prepareAndPublish();
    const previousSlug = fixture.organization.slug;
    const nextSlug = `${previousSlug}-new`;
    await updateOrganizationProfile(fixture.owner, fixture.organization.id, {
      slug: nextSlug,
    });
    await expect(
      getOrganizationPublicProfile(previousSlug),
    ).resolves.toMatchObject({
      redirectSlug: nextSlug,
      profile: { slug: nextSlug },
    });
    await expect(getOrganizationPublicProfile(nextSlug)).resolves.toMatchObject(
      {
        redirectSlug: null,
        profile: { slug: nextSlug },
      },
    );
    await expect(
      updateOrganizationProfile(fixture.owner, fixture.organization.id, {
        slug: "messages",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("reuses reporting, moderation, notifications and audit architecture", async () => {
    await prepareAndPublish();
    const first = await createOrReuseOrganizationReport({
      actor: fixture.outsider,
      organizationId: fixture.organization.id,
      category: "MISLEADING_IDENTITY",
      details:
        "The public identity contains information requiring an administrator review.",
    });
    const duplicate = await createOrReuseOrganizationReport({
      actor: fixture.outsider,
      organizationId: fixture.organization.id,
      category: "OTHER",
      details:
        "This second submission should reuse the already open moderation case.",
    });
    expect(duplicate).toEqual({ reportId: first.reportId, reused: true });

    await moderateOrganizationPublicProfile(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        action: "UNPUBLISH",
        reason:
          "Profile temporarily unpublished while the organization corrects its public identity.",
      },
    );
    await expect(
      getOrganizationPublicProfile(fixture.organization.slug),
    ).resolves.toBeNull();
    const adminDetail = await getAdminOrganization(
      fixture.platformAdmin,
      fixture.organization.id,
    );
    expect(adminDetail.reports.map(({ id }) => id)).toContain(first.reportId);
    await expect(
      prisma.auditLog.findFirst({
        where: {
          organizationId: fixture.organization.id,
          action: "ORGANIZATION_PUBLIC_PROFILE_UNPUBLISH",
        },
      }),
    ).resolves.toBeTruthy();
    await expect(
      prisma.notificationJob.findFirst({
        where: {
          recipientId: fixture.owner.id,
          templateKey: "ORGANIZATION_PUBLIC_PROFILE_CORRECTION",
        },
      }),
    ).resolves.toBeTruthy();
  });

  it("authorizes gallery ownership and rejects verification documents", async () => {
    await prepareAndPublish();
    const galleryAsset = await prisma.mediaAsset.create({
      data: {
        ownerId: fixture.owner.id,
        objectKey: `tests/${randomUUID()}/gallery.jpg`,
        storageProvider: "LOCAL",
        kind: "IMAGE",
        purpose: "ORGANIZATION_GALLERY_IMAGE",
        visibility: "PRIVATE",
        status: "ACTIVE",
        scanStatus: "CLEAN",
        originalFileName: "gallery.jpg",
        extension: "jpg",
        declaredMime: "image/jpeg",
        detectedMime: "image/jpeg",
        checksumSha256: "a".repeat(64),
        sizeBytes: 2048,
        width: 1200,
        height: 800,
        uploadExpiresAt: new Date(Date.now() + 60_000),
        uploadedAt: new Date(),
        validatedAt: new Date(),
      },
    });
    const item = await addOrganizationGalleryMedia(
      fixture.owner,
      fixture.organization.id,
      {
        mediaId: galleryAsset.id,
        caption: "Students receiving support",
        altText: "Students speaking with an organization representative",
        visibility: "PUBLIC",
      },
    );
    expect(item.sortOrder).toBe(0);
    await expect(
      addOrganizationGalleryMedia(fixture.outsider, fixture.organization.id, {
        mediaId: galleryAsset.id,
        altText: "Unauthorized reuse",
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 403 });

    const verificationAsset = await prisma.mediaAsset.create({
      data: {
        ownerId: fixture.owner.id,
        objectKey: `tests/${randomUUID()}/private-verification.pdf`,
        storageProvider: "LOCAL",
        kind: "DOCUMENT",
        purpose: "ORGANIZATION_VERIFICATION_DOCUMENT",
        visibility: "PRIVATE",
        status: "ACTIVE",
        scanStatus: "CLEAN",
        originalFileName: "private-verification.pdf",
        extension: "pdf",
        declaredMime: "application/pdf",
        detectedMime: "application/pdf",
        checksumSha256: "b".repeat(64),
        sizeBytes: 2048,
        uploadExpiresAt: new Date(Date.now() + 60_000),
        uploadedAt: new Date(),
        validatedAt: new Date(),
      },
    });
    await expect(
      addOrganizationGalleryMedia(fixture.owner, fixture.organization.id, {
        mediaId: verificationAsset.id,
        altText: "Private document",
        visibility: "PUBLIC",
      }),
    ).rejects.toMatchObject({ status: 400 });
    await removeOrganizationGalleryMedia(
      fixture.owner,
      fixture.organization.id,
      item.id,
    );
    await expect(
      prisma.organizationMedia.findUnique({ where: { id: item.id } }),
    ).resolves.toBeNull();
  });
});
