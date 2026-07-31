import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicOpportunityBySlug } from "@/lib/opportunities";
import {
  getApplicationForApplicant,
  saveApplicationDraft,
  startApplication,
  submitApplication,
  withdrawApplication,
} from "@/lib/opportunity-applications";
import {
  getOrganizationApplication,
  listOrganizationApplications,
  reviewerChangeApplicationStatus,
} from "@/lib/opportunity-application-review";
import { authorizeDocumentAccess } from "@/lib/opportunity-documents";
import { listLegacyScholarshipCards } from "@/lib/opportunity-legacy-scholarships";
import { moderateOpportunity } from "@/lib/opportunity-moderation";
import { getOrganizationScholarshipProjection } from "@/lib/opportunity-projections";
import {
  listSavedOpportunities,
  saveOpportunity,
  unsaveOpportunity,
} from "@/lib/opportunity-saved";
import { searchOpportunities } from "@/lib/opportunity-search";
import { prisma } from "@/lib/prisma";

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "opportunities.test";

let ids: {
  ownerId: string;
  editorId: string;
  applicantId: string;
  outsiderId: string;
  organizationId: string;
  otherOrganizationId: string;
  countryId: string;
  publishedId: string;
  publishedSlug: string;
  draftId: string;
  expiredId: string;
  externalId: string;
  questionId: string;
  documentId: string;
  legacyScholarshipId: string;
};

async function makeUser(prefix: string) {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@${domain}`,
      passwordHash: "x".repeat(60),
      firstName: prefix,
      lastName: "Tester",
      status: "ACTIVE",
      studyLevel: "BACHELORS",
      degree: "Computer Science",
    },
    select: { id: true },
  });
  return user.id;
}

postgresDescribe("opportunities (postgres)", () => {
  beforeAll(async () => {
    const country = await prisma.country.create({
      data: {
        name: `Opportunity Land ${randomUUID().slice(0, 8)}`,
        code: randomUUID().slice(0, 2).toUpperCase(),
      },
      select: { id: true },
    });

    const [ownerId, editorId, applicantId, outsiderId] = await Promise.all([
      makeUser("owner"),
      makeUser("editor"),
      makeUser("applicant"),
      makeUser("outsider"),
    ]);

    const organization = await prisma.organization.create({
      data: {
        slug: `opp-org-${randomUUID().slice(0, 8)}`,
        publicName: "Opportunity Org",
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        createdById: ownerId,
        countryId: country.id,
        capabilities: {
          create: [
            { key: "SCHOLARSHIPS", status: "ENABLED" },
            { key: "INTERNSHIPS_JOBS", status: "ENABLED" },
          ],
        },
        memberships: {
          create: [
            { userId: ownerId, role: "OWNER", status: "ACTIVE" },
            { userId: editorId, role: "EDITOR", status: "ACTIVE" },
          ],
        },
      },
      select: { id: true },
    });

    const otherOrganization = await prisma.organization.create({
      data: {
        slug: `other-org-${randomUUID().slice(0, 8)}`,
        publicName: "Other Org",
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        createdById: outsiderId,
        countryId: country.id,
        memberships: {
          create: [{ userId: outsiderId, role: "OWNER", status: "ACTIVE" }],
        },
      },
      select: { id: true },
    });

    const future = new Date(Date.now() + 60 * 86_400_000);

    const published = await prisma.opportunity.create({
      data: {
        slug: `published-${randomUUID().slice(0, 8)}`,
        type: "SCHOLARSHIP",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: organization.id,
        createdByUserId: ownerId,
        countryId: country.id,
        title: "Published Engineering Scholarship",
        shortDescription:
          "A fully funded scholarship for engineering students.",
        description: "Details about the fully funded engineering scholarship.",
        applicationMethod: "KONDO_APPLICATION",
        applicationDeadline: future,
        publishedAt: new Date(),
        scholarshipDetail: { create: { fundingType: "FULLY_FUNDED" } },
        degreeLevels: { create: [{ degreeLevel: "BACHELORS" }] },
        questions: {
          create: [
            {
              type: "LONG_TEXT",
              label: "Why do you want this?",
              required: true,
            },
          ],
        },
        requirements: {
          create: [{ documentType: "CV", required: true }],
        },
      },
      select: { id: true, slug: true, questions: { select: { id: true } } },
    });

    const draft = await prisma.opportunity.create({
      data: {
        slug: `draft-${randomUUID().slice(0, 8)}`,
        type: "INTERNSHIP",
        lifecycle: "DRAFT",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: organization.id,
        createdByUserId: ownerId,
        title: "Draft Internship",
        shortDescription: "A draft internship that must stay private.",
        description: "Draft description for the internship opportunity.",
        applicationMethod: "KONDO_APPLICATION",
      },
      select: { id: true },
    });

    const expired = await prisma.opportunity.create({
      data: {
        slug: `expired-${randomUUID().slice(0, 8)}`,
        type: "PART_TIME_JOB",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: organization.id,
        createdByUserId: ownerId,
        title: "Expired Campus Job",
        shortDescription: "An expired job that must leave active search.",
        description: "Description for the expired campus job opportunity.",
        applicationMethod: "KONDO_APPLICATION",
        applicationDeadline: new Date(Date.now() - 86_400_000),
        expiresAt: new Date(Date.now() - 86_400_000),
        publishedAt: new Date(Date.now() - 30 * 86_400_000),
      },
      select: { id: true },
    });

    const external = await prisma.opportunity.create({
      data: {
        slug: `external-${randomUUID().slice(0, 8)}`,
        type: "FULL_TIME_JOB",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: organization.id,
        createdByUserId: ownerId,
        title: "External Application Role",
        shortDescription: "A role that is applied for on the provider site.",
        description: "Description for the externally applied role.",
        applicationMethod: "EXTERNAL_URL",
        externalApplicationUrl: "https://example.org/apply",
        applicationDeadline: future,
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    const media = await prisma.mediaAsset.create({
      data: {
        ownerId: applicantId,
        objectKey: `opportunity-doc/${randomUUID()}`,
        storageProvider: "LOCAL",
        kind: "DOCUMENT",
        purpose: "OPPORTUNITY_APPLICATION_DOCUMENT",
        visibility: "PRIVATE",
        status: "ACTIVE",
        scanStatus: "CLEAN",
        originalFileName: "cv.pdf",
        extension: "pdf",
        declaredMime: "application/pdf",
        // The MediaAsset_active_validation_check constraint requires a fully
        // validated, scanned asset before status may be ACTIVE.
        detectedMime: "application/pdf",
        checksumSha256: "a".repeat(64),
        sizeBytes: 2048,
        uploadExpiresAt: new Date(Date.now() + 86_400_000),
        uploadedAt: new Date(),
        validatedAt: new Date(),
      },
      select: { id: true },
    });

    const document = await prisma.userOpportunityDocument.create({
      data: {
        userId: applicantId,
        mediaId: media.id,
        category: "CV",
        displayName: "My CV",
      },
      select: { id: true },
    });

    const legacy = await prisma.scholarship.create({
      data: {
        slug: `legacy-${randomUUID().slice(0, 8)}`,
        title: "Legacy Directory Scholarship",
        provider: "Legacy Provider",
        fundingType: "FULL",
        status: "OPEN",
        applicationUrl: "https://example.org/legacy",
        description: "A legacy scholarship that stays in its own directory.",
        isActive: true,
        countryId: country.id,
      },
      select: { id: true },
    });

    ids = {
      ownerId,
      editorId,
      applicantId,
      outsiderId,
      organizationId: organization.id,
      otherOrganizationId: otherOrganization.id,
      countryId: country.id,
      publishedId: published.id,
      publishedSlug: published.slug,
      draftId: draft.id,
      expiredId: expired.id,
      externalId: external.id,
      questionId: published.questions[0].id,
      documentId: document.id,
      legacyScholarshipId: legacy.id,
    };
  });

  afterAll(async () => {
    if (!isolated) return;
    // Clean up by test domain rather than by captured ids so a run that failed
    // during setup cannot leave rows behind for the next run.
    const users = await prisma.user.findMany({
      where: { email: { endsWith: `@${domain}` } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    const organizations = await prisma.organization.findMany({
      where: { createdById: { in: userIds } },
      select: { id: true },
    });
    const organizationIds = organizations.map(
      (organization) => organization.id,
    );

    await prisma.opportunity.deleteMany({
      where: {
        OR: [
          { publisherOrganizationId: { in: organizationIds } },
          { createdByUserId: { in: userIds } },
        ],
      },
    });
    await prisma.userOpportunityDocument.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.mediaAsset.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    await prisma.scholarship.deleteMany({
      where: { title: "Legacy Directory Scholarship" },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.country.deleteMany({
      where: { name: { startsWith: "Opportunity Land " } },
    });
  });

  it("exposes a published opportunity and hides drafts and expired records", async () => {
    const published = await getPublicOpportunityBySlug(ids.publishedSlug);
    expect(published?.title).toBe("Published Engineering Scholarship");

    const results = await searchOpportunities({ limit: 50 });
    const foundIds = results.items.map((item) => item.id);
    expect(foundIds).toContain(ids.publishedId);
    expect(foundIds).not.toContain(ids.draftId);
    expect(foundIds).not.toContain(ids.expiredId);
  });

  it("filters search by category and degree level", async () => {
    const scholarships = await searchOpportunities({
      category: "scholarships",
      limit: 50,
    });
    expect(scholarships.items.map((item) => item.id)).toContain(
      ids.publishedId,
    );

    const phd = await searchOpportunities({
      degreeLevels: ["DOCTORATE"],
      limit: 50,
    });
    expect(phd.items.map((item) => item.id)).not.toContain(ids.publishedId);
  });

  it("never exposes private fields in the public DTO", async () => {
    const published = await getPublicOpportunityBySlug(ids.publishedSlug);
    const serialized = JSON.stringify(published);
    expect(serialized).not.toContain("moderationNote");
    expect(serialized).not.toContain("publicationBlockedAt");
    expect(serialized).not.toContain("internalNote");
  });

  it("saves and unsaves an opportunity without revealing savers", async () => {
    await saveOpportunity({
      userId: ids.applicantId,
      opportunityId: ids.publishedId,
    });
    // A repeat save is idempotent rather than a duplicate row.
    await saveOpportunity({
      userId: ids.applicantId,
      opportunityId: ids.publishedId,
    });
    const count = await prisma.opportunitySaved.count({
      where: { userId: ids.applicantId, opportunityId: ids.publishedId },
    });
    expect(count).toBe(1);

    const saved = await listSavedOpportunities({ userId: ids.applicantId });
    expect(saved.map((entry) => entry.opportunity?.id)).toContain(
      ids.publishedId,
    );

    const publicDto = await getPublicOpportunityBySlug(ids.publishedSlug);
    expect(JSON.stringify(publicDto)).not.toContain(ids.applicantId);

    await unsaveOpportunity({
      userId: ids.applicantId,
      opportunityId: ids.publishedId,
    });
    expect(
      await prisma.opportunitySaved.count({
        where: { userId: ids.applicantId, opportunityId: ids.publishedId },
      }),
    ).toBe(0);
  });

  it("refuses a Kondo application for an external-only opportunity", async () => {
    await expect(
      startApplication({
        userId: ids.applicantId,
        opportunityId: ids.externalId,
      }),
    ).rejects.toThrow(/does not accept applications/i);
  });

  it("runs the full application lifecycle and blocks duplicates", async () => {
    const draft = await startApplication({
      userId: ids.applicantId,
      opportunityId: ids.publishedId,
    });
    expect(draft.status).toBe("DRAFT");

    // Starting again returns the same draft rather than creating a second one.
    const again = await startApplication({
      userId: ids.applicantId,
      opportunityId: ids.publishedId,
    });
    expect(again.id).toBe(draft.id);

    await expect(
      submitApplication({
        userId: ids.applicantId,
        applicationId: draft.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/required question/i);

    await saveApplicationDraft({
      userId: ids.applicantId,
      applicationId: draft.id,
      answers: [{ questionId: ids.questionId, answerText: "Because it fits." }],
    });

    await expect(
      submitApplication({
        userId: ids.applicantId,
        applicationId: draft.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/required document/i);

    await saveApplicationDraft({
      userId: ids.applicantId,
      applicationId: draft.id,
      documentIds: [ids.documentId],
    });

    const submitted = await submitApplication({
      userId: ids.applicantId,
      applicationId: draft.id,
      consentAccepted: true,
    });
    expect(submitted.status).toBe("SUBMITTED");

    // A second submission is refused.
    await expect(
      submitApplication({
        userId: ids.applicantId,
        applicationId: draft.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/already submitted/i);
  });

  it("keeps the submission snapshot stable when the profile changes", async () => {
    const application = await prisma.opportunityApplication.findFirstOrThrow({
      where: {
        applicantUserId: ids.applicantId,
        opportunityId: ids.publishedId,
      },
      select: { id: true, applicantSnapshot: true },
    });
    const snapshot = JSON.stringify(application.applicantSnapshot);
    expect(snapshot).toContain("applicant");

    await prisma.user.update({
      where: { id: ids.applicantId },
      data: { firstName: "Renamed", degree: "Completely Different" },
    });

    const after = await prisma.opportunityApplication.findUniqueOrThrow({
      where: { id: application.id },
      select: { applicantSnapshot: true },
    });
    // The historical submission is untouched by the later profile edit.
    expect(JSON.stringify(after.applicantSnapshot)).toBe(snapshot);
  });

  it("blocks submission after the deadline but preserves the draft", async () => {
    const late = await prisma.opportunity.create({
      data: {
        slug: `late-${randomUUID().slice(0, 8)}`,
        type: "SCHOLARSHIP",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: ids.organizationId,
        createdByUserId: ids.ownerId,
        title: "Deadline Test Scholarship",
        shortDescription: "Used to verify the transactional deadline recheck.",
        description: "Description for the deadline recheck scholarship.",
        applicationMethod: "KONDO_APPLICATION",
        applicationDeadline: new Date(Date.now() + 86_400_000),
        publishedAt: new Date(),
      },
      select: { id: true },
    });

    const draft = await startApplication({
      userId: ids.outsiderId,
      opportunityId: late.id,
    });

    // The deadline passes while the applicant is still editing.
    await prisma.opportunity.update({
      where: { id: late.id },
      data: { applicationDeadline: new Date(Date.now() - 1000) },
    });

    await expect(
      submitApplication({
        userId: ids.outsiderId,
        applicationId: draft.id,
        consentAccepted: true,
      }),
    ).rejects.toThrow(/deadline has passed/i);

    const preserved = await getApplicationForApplicant({
      userId: ids.outsiderId,
      applicationId: draft.id,
    });
    expect(preserved?.status).toBe("DRAFT");
  });

  it("only lets authorized reviewers of the same organization read applications", async () => {
    const owner = await listOrganizationApplications({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
    });
    expect(owner.length).toBeGreaterThan(0);

    // EDITOR has no application permission.
    await expect(
      listOrganizationApplications({
        userId: ids.editorId,
        organizationId: ids.organizationId,
      }),
    ).rejects.toThrow(/permission/i);

    // A member of another organization has no access at all.
    await expect(
      listOrganizationApplications({
        userId: ids.outsiderId,
        organizationId: ids.organizationId,
      }),
    ).rejects.toThrow(/access/i);
  });

  it("keeps internal notes out of the applicant view", async () => {
    const application = await prisma.opportunityApplication.findFirstOrThrow({
      where: {
        applicantUserId: ids.applicantId,
        opportunityId: ids.publishedId,
      },
      select: { id: true },
    });

    await reviewerChangeApplicationStatus({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      applicationId: application.id,
      toStatus: "UNDER_REVIEW",
      applicantVisibleNote: "We are reviewing your application.",
      internalNote: "SECRET-REVIEWER-ONLY-NOTE",
    });

    const applicantView = await getApplicationForApplicant({
      userId: ids.applicantId,
      applicationId: application.id,
    });
    expect(JSON.stringify(applicantView)).not.toContain(
      "SECRET-REVIEWER-ONLY-NOTE",
    );
    expect(JSON.stringify(applicantView)).toContain(
      "We are reviewing your application.",
    );

    const reviewerView = await getOrganizationApplication({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      applicationId: application.id,
    });
    expect(JSON.stringify(reviewerView)).toContain("SECRET-REVIEWER-ONLY-NOTE");
  });

  it("enforces document access rules", async () => {
    // The owner of the document can always reach it.
    await expect(
      authorizeDocumentAccess({
        viewerUserId: ids.applicantId,
        documentId: ids.documentId,
      }),
    ).resolves.toMatchObject({ role: "OWNER" });

    // An authorized reviewer of an application it is attached to can reach it.
    await expect(
      authorizeDocumentAccess({
        viewerUserId: ids.ownerId,
        documentId: ids.documentId,
      }),
    ).resolves.toMatchObject({ role: "REVIEWER" });

    // An unrelated organization member cannot.
    await expect(
      authorizeDocumentAccess({
        viewerUserId: ids.outsiderId,
        documentId: ids.documentId,
      }),
    ).rejects.toThrow(/not found/i);

    // Neither can an organization member without the review permission.
    await expect(
      authorizeDocumentAccess({
        viewerUserId: ids.editorId,
        documentId: ids.documentId,
      }),
    ).rejects.toThrow(/not found/i);

    // The raw storage key is never returned.
    const access = await authorizeDocumentAccess({
      viewerUserId: ids.applicantId,
      documentId: ids.documentId,
    });
    expect(JSON.stringify(access)).not.toContain("opportunity-doc/");
  });

  it("projects real opportunities onto the organization page", async () => {
    const projection = await getOrganizationScholarshipProjection(
      ids.organizationId,
    );
    expect(projection.available).toBe(true);
    expect(projection.itemCount).toBeGreaterThan(0);
    expect(projection.visibility).toBe("PUBLIC");

    const empty = await getOrganizationScholarshipProjection(
      ids.otherOrganizationId,
    );
    expect(empty.available).toBe(false);
    expect(empty.visibility).toBe("HIDDEN");
    expect(empty.sectionRoute).toBeNull();
  });

  it("surfaces legacy scholarships without duplicating them", async () => {
    const legacy = await listLegacyScholarshipCards({ limit: 20 });
    expect(legacy.map((entry) => entry.id)).toContain(ids.legacyScholarshipId);
    // Legacy rows keep their own directory URL rather than a second
    // /opportunities URL.
    const card = legacy.find((entry) => entry.id === ids.legacyScholarshipId);
    expect(card?.href).toMatch(/^\/student-hub\/scholarships\//);

    // Once a unified record claims the source, the legacy row disappears.
    await prisma.opportunity.update({
      where: { id: ids.publishedId },
      data: {
        legacySourceKey: `legacy-scholarship:${ids.legacyScholarshipId}`,
      },
    });
    const deduped = await listLegacyScholarshipCards({ limit: 20 });
    expect(deduped.map((entry) => entry.id)).not.toContain(
      ids.legacyScholarshipId,
    );

    await prisma.opportunity.update({
      where: { id: ids.publishedId },
      data: { legacySourceKey: null },
    });
  });

  it("removes an opportunity without destroying submitted applications", async () => {
    await moderateOpportunity({
      adminUserId: ids.ownerId,
      opportunityId: ids.publishedId,
      action: "REMOVE",
      publisherVisibleNote: "Removed for review.",
      internalNote: "Internal moderation detail.",
    });

    // Gone from every public surface.
    expect(await getPublicOpportunityBySlug(ids.publishedSlug)).toBeNull();
    const results = await searchOpportunities({ limit: 50 });
    expect(results.items.map((item) => item.id)).not.toContain(ids.publishedId);

    // The applicant keeps their application and sees a safe unavailable state.
    const application = await prisma.opportunityApplication.findFirstOrThrow({
      where: {
        applicantUserId: ids.applicantId,
        opportunityId: ids.publishedId,
      },
      select: { id: true },
    });
    const view = await getApplicationForApplicant({
      userId: ids.applicantId,
      applicationId: application.id,
    });
    expect(view).not.toBeNull();
    expect(view?.opportunity.available).toBe(false);
    expect(view?.opportunity.href).toBeNull();
  });

  it("lets an applicant withdraw only from valid states", async () => {
    const application = await prisma.opportunityApplication.findFirstOrThrow({
      where: {
        applicantUserId: ids.applicantId,
        opportunityId: ids.publishedId,
      },
      select: { id: true },
    });
    const result = await withdrawApplication({
      userId: ids.applicantId,
      applicationId: application.id,
    });
    expect(result.status).toBe("WITHDRAWN");

    // A withdrawn application cannot be withdrawn again.
    await expect(
      withdrawApplication({
        userId: ids.applicantId,
        applicationId: application.id,
      }),
    ).rejects.toThrow(/cannot move/i);
  });
});
