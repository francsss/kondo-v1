import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  updateOrganizationLifecycleAsAdmin,
  updateOrganizationPartnerStatus,
} from "@/lib/organization-admin";
import {
  createOrganizationInvitation,
  decideOrganizationInvitationById,
} from "@/lib/organization-invitations";
import { getMediaForDelivery } from "@/lib/media";
import {
  changeOrganizationMemberRole,
  removeOrganizationMember,
} from "@/lib/organization-memberships";
import {
  createOwnershipTransfer,
  decideOwnershipTransfer,
} from "@/lib/organization-ownership";
import { updateOrganizationProfile } from "@/lib/organization-profile-service";
import {
  decideOrganizationVerification,
  getAdminOrganizationVerification,
  listOrganizationVerificationRequests,
  saveOrganizationVerificationDraft,
  submitOrganizationVerification,
} from "@/lib/organization-verification";
import {
  getOrganizationWorkspace,
  listOrganizationWorkspaces,
} from "@/lib/organization-workspaces";
import { prisma } from "@/lib/prisma";

const isIsolatedPostgres =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isIsolatedPostgres
  ? describe.sequential
  : describe.skip;
const testDomain = "organization-workspace.test";

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
  await prisma.organization.deleteMany({
    where: { id: { in: organizationIds } },
  });
  await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: userIds } } });
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
  const [
    owner,
    organizationAdmin,
    invitee,
    platformAdmin,
    superAdmin,
    moderator,
  ] = await Promise.all(
    [
      ["owner", "MEMBER"],
      ["organization-admin", "MEMBER"],
      ["invitee", "MEMBER"],
      ["platform-admin", "ADMIN"],
      ["super-admin", "SUPER_ADMIN"],
      ["moderator", "MODERATOR"],
    ].map(([label, role]) =>
      prisma.user.create({
        data: {
          email: `${label}-${suffix}@${testDomain}`,
          firstName: label!
            .split("-")
            .map((part) => part[0]!.toUpperCase() + part.slice(1))
            .join(" "),
          lastName: "Workspace",
          role: role as "MEMBER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN",
          status: "ACTIVE",
        },
      }),
    ),
  );
  const organization = await prisma.organization.create({
    data: {
      publicName: `Workspace ${suffix.slice(0, 8)}`,
      legalName: `Workspace ${suffix.slice(0, 8)} Limited`,
      slug: `workspace-${suffix.slice(0, 12)}`,
      type: "SERVICE_PROVIDER",
      countryId: country.id,
      lifecycleStatus: "ACTIVE",
      setupCompletedAt: new Date(),
      createdById: owner.id,
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER", status: "ACTIVE" },
          {
            userId: organizationAdmin.id,
            role: "ADMIN",
            status: "ACTIVE",
          },
        ],
      },
      capabilities: {
        create: [{ key: "STUDENT_SERVICES", status: "ENABLED" }],
      },
    },
  });
  return {
    country,
    owner,
    organizationAdmin,
    invitee,
    platformAdmin,
    superAdmin,
    moderator,
    organization,
  };
}

postgresDescribe("professional organization workspace", () => {
  beforeEach(async () => {
    await cleanup();
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("rotates hashed invitation tokens and applies team access atomically", async () => {
    await createOrganizationInvitation(fixture.owner, fixture.organization.id, {
      email: fixture.invitee.email,
      role: "EDITOR",
    });
    const invitation = await prisma.organizationInvitation.findFirstOrThrow({
      where: {
        organizationId: fixture.organization.id,
        emailNormalized: fixture.invitee.email,
        status: "PENDING",
      },
    });
    expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(invitation.tokenHash).not.toContain(fixture.invitee.email);

    await expect(
      decideOrganizationInvitationById(
        fixture.platformAdmin,
        invitation.id,
        "ACCEPT",
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      decideOrganizationInvitationById(
        fixture.invitee,
        invitation.id,
        "ACCEPT",
      ),
    ).resolves.toMatchObject({ status: "ACCEPTED" });
    await expect(
      prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: fixture.organization.id,
            userId: fixture.invitee.id,
          },
        },
      }),
    ).resolves.toMatchObject({ role: "EDITOR", status: "ACTIVE" });
    await expect(
      decideOrganizationInvitationById(
        fixture.invitee,
        invitation.id,
        "ACCEPT",
      ),
    ).rejects.toMatchObject({ status: 409 });

    await changeOrganizationMemberRole(
      fixture.owner,
      fixture.organization.id,
      fixture.invitee.id,
      "VIEWER",
    );
    await removeOrganizationMember(
      fixture.owner,
      fixture.organization.id,
      fixture.invitee.id,
    );
    await expect(
      prisma.organizationMembership.findUnique({
        where: {
          organizationId_userId: {
            organizationId: fixture.organization.id,
            userId: fixture.invitee.id,
          },
        },
      }),
    ).resolves.toMatchObject({
      role: "VIEWER",
      status: "REMOVED",
      removedById: fixture.owner.id,
    });
    await expect(
      getOrganizationWorkspace(fixture.invitee.id, fixture.organization.slug),
    ).rejects.toMatchObject({ status: 403 });

    await createOrganizationInvitation(fixture.owner, fixture.organization.id, {
      email: fixture.platformAdmin.email,
      role: "VIEWER",
    });
    const expired = await prisma.organizationInvitation.findFirstOrThrow({
      where: {
        organizationId: fixture.organization.id,
        emailNormalized: fixture.platformAdmin.email,
        status: "PENDING",
      },
    });
    await prisma.organizationInvitation.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await expect(
      decideOrganizationInvitationById(
        fixture.platformAdmin,
        expired.id,
        "ACCEPT",
      ),
    ).rejects.toMatchObject({ status: 410 });
    await expect(
      prisma.organizationInvitation.findUnique({
        where: { id: expired.id },
        select: { status: true },
      }),
    ).resolves.toEqual({ status: "EXPIRED" });
  });

  it("transfers ownership in two steps and preserves old slugs as aliases", async () => {
    const transfer = await createOwnershipTransfer(
      fixture.owner,
      fixture.organization.id,
      fixture.organizationAdmin.id,
    );
    await decideOwnershipTransfer(
      fixture.organizationAdmin,
      transfer.id,
      "ACCEPT",
    );
    const memberships = await prisma.organizationMembership.findMany({
      where: { organizationId: fixture.organization.id, status: "ACTIVE" },
      select: { userId: true, role: true },
    });
    expect(
      memberships.find(({ userId }) => userId === fixture.owner.id)?.role,
    ).toBe("ADMIN");
    expect(
      memberships.find(({ userId }) => userId === fixture.organizationAdmin.id)
        ?.role,
    ).toBe("OWNER");

    const previousSlug = fixture.organization.slug;
    const nextSlug = `${previousSlug}-official`;
    await updateOrganizationProfile(
      fixture.organizationAdmin,
      fixture.organization.id,
      { slug: nextSlug },
    );
    await expect(
      prisma.organizationSlugAlias.findUnique({
        where: { slug: previousSlug },
      }),
    ).resolves.toMatchObject({ organizationId: fixture.organization.id });
    await expect(
      prisma.organization.findUnique({
        where: { id: fixture.organization.id },
        select: { slug: true },
      }),
    ).resolves.toEqual({ slug: nextSlug });
  });

  it("keeps private verification, lifecycle and partner decisions separate", async () => {
    const media = await prisma.mediaAsset.create({
      data: {
        ownerId: fixture.owner.id,
        objectKey: `tests/${randomUUID()}/verification.pdf`,
        storageProvider: "LOCAL",
        kind: "DOCUMENT",
        purpose: "ORGANIZATION_VERIFICATION_DOCUMENT",
        visibility: "PRIVATE",
        status: "ACTIVE",
        scanStatus: "CLEAN",
        originalFileName: "registration.pdf",
        extension: "pdf",
        declaredMime: "application/pdf",
        detectedMime: "application/pdf",
        checksumSha256: "a".repeat(64),
        sizeBytes: 2048,
        uploadExpiresAt: new Date(Date.now() + 60_000),
        uploadedAt: new Date(),
        validatedAt: new Date(),
      },
    });
    const verificationInput = {
      legalName: fixture.organization.legalName!,
      registrationNumber: "REG-2026-001",
      registrationCountryId: fixture.country.id,
      authorityDescription:
        "The owner is authorized by the registered organization to manage this workspace.",
      officialWebsite: "https://organization.example",
      publicContactEmail: fixture.owner.email,
      documents: [
        {
          mediaId: media.id,
          type: "BUSINESS_REGISTRATION" as const,
          label: "Business registration",
        },
      ],
    };
    const draft = await saveOrganizationVerificationDraft(
      fixture.owner,
      fixture.organization.id,
      verificationInput,
    );
    expect(draft.status).toBe("DRAFT");
    await expect(
      getAdminOrganizationVerification(fixture.platformAdmin, draft.id),
    ).rejects.toMatchObject({ status: 404 });
    const reviewQueue = await listOrganizationVerificationRequests(
      fixture.platformAdmin,
    );
    expect(reviewQueue.records.some(({ id }) => id === draft.id)).toBe(false);

    const submitted = await submitOrganizationVerification(
      fixture.owner,
      fixture.organization.id,
      verificationInput,
    );
    expect(submitted.status).toBe("SUBMITTED");
    await expect(
      getMediaForDelivery(media.id, fixture.invitee),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      decideOrganizationVerification(fixture.moderator, submitted.id, {
        status: "APPROVED",
        userVisibleResponse:
          "This reviewer does not have organization verification permission.",
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateOrganizationPartnerStatus(
        fixture.superAdmin,
        fixture.organization.id,
        true,
        "Partner review completed before verification.",
      ),
    ).rejects.toMatchObject({ status: 409 });

    await decideOrganizationVerification(fixture.platformAdmin, submitted.id, {
      status: "MORE_INFORMATION_REQUIRED",
      userVisibleResponse:
        "Please confirm the registration identifier in the official document.",
      reviewerNote: "Registration identifier needs a second review.",
    });
    const resubmitted = await submitOrganizationVerification(
      fixture.owner,
      fixture.organization.id,
      {
        legalName: fixture.organization.legalName!,
        registrationNumber: "REG-2026-001-CONFIRMED",
        registrationCountryId: fixture.country.id,
        authorityDescription:
          "The owner is authorized by the registered organization to manage this workspace.",
        officialWebsite: "https://organization.example",
        publicContactEmail: fixture.owner.email,
        documents: [
          {
            mediaId: media.id,
            type: "BUSINESS_REGISTRATION",
            label: "Business registration",
          },
        ],
      },
    );
    expect(resubmitted.status).toBe("SUBMITTED");
    expect(resubmitted.version).toBeGreaterThan(submitted.version);
    await decideOrganizationVerification(fixture.platformAdmin, submitted.id, {
      status: "APPROVED",
      userVisibleResponse:
        "The authority and supporting registration document were confirmed.",
      reviewerNote: "Private verification evidence reviewed.",
    });
    await expect(
      prisma.organization.findUnique({
        where: { id: fixture.organization.id },
        select: { verificationStatus: true, isOfficialPartner: true },
      }),
    ).resolves.toEqual({
      verificationStatus: "VERIFIED",
      isOfficialPartner: false,
    });
    await updateOrganizationPartnerStatus(
      fixture.superAdmin,
      fixture.organization.id,
      true,
      "Approved for the official Kondo partner programme.",
    );
    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "SUSPENDED",
        reason: "Temporary operational review is required.",
      },
    );
    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "ACTIVE",
        reason: "Operational review completed successfully.",
      },
    );
    await expect(
      prisma.organization.findUnique({
        where: { id: fixture.organization.id },
        select: {
          verificationStatus: true,
          isOfficialPartner: true,
          lifecycleStatus: true,
          suspensionReason: true,
        },
      }),
    ).resolves.toEqual({
      verificationStatus: "VERIFIED",
      isOfficialPartner: true,
      lifecycleStatus: "ACTIVE",
      suspensionReason: null,
    });
    await expect(
      prisma.mediaAsset.findUnique({
        where: { id: media.id },
        select: {
          visibility: true,
          attachmentType: true,
          attachmentId: true,
        },
      }),
    ).resolves.toMatchObject({
      visibility: "PRIVATE",
      attachmentType: "ORGANIZATION_VERIFICATION",
      attachmentId: submitted.id,
    });
  });

  it("blocks mutations while suspended and removes archived workspaces from access", async () => {
    await expect(
      getOrganizationWorkspace(
        fixture.platformAdmin.id,
        fixture.organization.slug,
      ),
    ).rejects.toMatchObject({ status: 403 });

    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "SUSPENDED",
        reason: "Security review in progress.",
      },
    );
    await expect(
      changeOrganizationMemberRole(
        fixture.owner,
        fixture.organization.id,
        fixture.organizationAdmin.id,
        "EDITOR",
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateOrganizationProfile(fixture.owner, fixture.organization.id, {
        tagline: "This mutation must remain blocked.",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      createOrganizationInvitation(fixture.owner, fixture.organization.id, {
        email: fixture.invitee.email,
        role: "VIEWER",
      }),
    ).rejects.toMatchObject({ status: 409 });

    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "ACTIVE",
        reason: "Security review completed.",
      },
    );
    await updateOrganizationLifecycleAsAdmin(
      fixture.platformAdmin,
      fixture.organization.id,
      {
        status: "ARCHIVED",
        reason: "The organization requested archival.",
      },
    );
    await expect(
      getOrganizationWorkspace(fixture.owner.id, fixture.organization.slug),
    ).rejects.toMatchObject({ status: 410 });
    const remainingWorkspaces = await listOrganizationWorkspaces(
      fixture.owner.id,
    );
    expect(
      remainingWorkspaces.some(
        (organization) => organization.id === fixture.organization.id,
      ),
    ).toBe(false);
  });
});
