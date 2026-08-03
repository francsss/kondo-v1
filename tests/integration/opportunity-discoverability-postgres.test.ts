import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestCountry } from "../helpers/reference-data";
import {
  jobDetailSchema,
  opportunityDraftSchema,
  scholarshipDetailSchema,
} from "@/features/opportunities/schemas";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import {
  activeWorkspaceNavigationKey,
  opportunitySetupState,
  organizationWorkspaceNavigation,
} from "@/lib/organization-workspace-navigation";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { listApplicationsForApplicant } from "@/lib/opportunity-applications";
import { listOrganizationApplications } from "@/lib/opportunity-application-review";
import { listLegacyScholarshipCards } from "@/lib/opportunity-legacy-scholarships";
import {
  createOrganizationOpportunity,
  getOrganizationOpportunityForEdit,
  listOrganizationOpportunities,
  transitionOrganizationOpportunity,
} from "@/lib/opportunity-management";
import { OpportunityAccessError } from "@/lib/opportunity-permissions";
import { searchOpportunities } from "@/lib/opportunity-search";
import { prisma } from "@/lib/prisma";
import { studentHubSectionTypes } from "@/lib/student-hub-sections";

/**
 * Route discoverability for the Part 5 Opportunities domain.
 *
 * These tests follow the path a real member takes — open the workspace, read
 * the navigation, act on what it offers — rather than calling services with
 * ids that only a URL-typing developer would have.
 */

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "discoverability.test";

let ids: {
  ownerId: string;
  editorId: string;
  outsiderId: string;
  applicantId: string;
  organizationId: string;
  organizationSlug: string;
  barelySetUpId: string;
  barelySetUpSlug: string;
  countryId: string;
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
      studyLevel: "MASTERS",
      degree: "Engineering",
    },
    select: { id: true },
  });
  return user.id;
}

function membershipOf(workspace: {
  membership: { storedRole: string; status: string };
}) {
  return {
    role: workspace.membership.storedRole as never,
    status: workspace.membership.status as never,
  };
}

type DraftType =
  "SCHOLARSHIP" | "INTERNSHIP" | "PART_TIME_JOB" | "RESEARCH_OPPORTUNITY";

/**
 * Builds a publishable draft through the real authoring schema, so the test
 * exercises the same validation the workspace form does.
 */
async function draftFor(
  userId: string,
  organizationId: string,
  type: DraftType,
  title: string,
) {
  const draft = opportunityDraftSchema.parse({
    type,
    title,
    shortDescription: `${title} short description for the workspace test.`,
    description: `${title} full description used by the discoverability test, long enough to satisfy validation.`,
    applicationMethod: "EXTERNAL_URL",
    externalApplicationUrl: "https://example.edu/apply",
    officialSourceUrl: "https://example.edu/official",
    applicationDeadline: new Date(Date.now() + 45 * 86_400_000),
  });
  return createOrganizationOpportunity({
    userId,
    organizationId,
    draft,
    scholarship:
      type === "SCHOLARSHIP"
        ? scholarshipDetailSchema.parse({ fundingType: "FULLY_FUNDED" })
        : null,
    job:
      type === "SCHOLARSHIP"
        ? null
        : jobDetailSchema.parse({
            employmentType:
              type === "INTERNSHIP"
                ? "INTERNSHIP"
                : type === "PART_TIME_JOB"
                  ? "PART_TIME"
                  : "RESEARCH_ASSISTANT",
          }),
  });
}

postgresDescribe("opportunity route discoverability (postgres)", () => {
  beforeAll(async () => {
    const country = await createTestCountry(prisma, {
      name: `Discover Land ${randomUUID().slice(0, 8)}`,
    });

    const [ownerId, editorId, outsiderId, applicantId] = await Promise.all([
      makeUser("owner"),
      makeUser("editor"),
      makeUser("outsider"),
      makeUser("applicant"),
    ]);

    const organizationSlug = `discover-org-${randomUUID().slice(0, 8)}`;
    const organization = await prisma.organization.create({
      data: {
        slug: organizationSlug,
        publicName: "Discoverable Organization",
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        publicProfileStatus: "PUBLISHED",
        createdById: ownerId,
        countryId: country.id,
        capabilities: {
          create: [
            { key: "SCHOLARSHIPS", status: "ENABLED" },
            { key: "INTERNSHIPS_JOBS", status: "ENABLED" },
            { key: "UNIVERSITY_INFORMATION", status: "ENABLED" },
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

    // An organization with no opportunity capability at all.
    const barelySetUpSlug = `bare-org-${randomUUID().slice(0, 8)}`;
    const barelySetUp = await prisma.organization.create({
      data: {
        slug: barelySetUpSlug,
        publicName: "Bare Organization",
        type: "COMPANY",
        lifecycleStatus: "ACTIVE",
        createdById: ownerId,
        countryId: country.id,
        capabilities: { create: [{ key: "HOUSING", status: "ENABLED" }] },
        memberships: {
          create: [{ userId: ownerId, role: "OWNER", status: "ACTIVE" }],
        },
      },
      select: { id: true },
    });

    const legacy = await prisma.scholarship.create({
      data: {
        slug: `legacy-discover-${randomUUID().slice(0, 8)}`,
        title: "Legacy Provincial Scholarship",
        provider: "Provincial Education Bureau",
        description:
          "A legacy scholarship record that must remain publicly visible.",
        fundingType: "PARTIAL",
        status: "OPEN",
        isActive: true,
        countryId: country.id,
        applicationUrl: "https://example.edu/legacy-scholarship",
      },
      select: { id: true },
    });

    ids = {
      ownerId,
      editorId,
      outsiderId,
      applicantId,
      organizationId: organization.id,
      organizationSlug,
      barelySetUpId: barelySetUp.id,
      barelySetUpSlug,
      countryId: country.id,
      legacyScholarshipId: legacy.id,
    };
  });

  afterAll(async () => {
    await prisma.opportunity.deleteMany({
      where: {
        publisherOrganizationId: {
          in: [ids.organizationId, ids.barelySetUpId],
        },
      },
    });
    await prisma.scholarship.deleteMany({
      where: { id: ids.legacyScholarshipId },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ids.organizationId, ids.barelySetUpId] } },
    });
    // Audit rows written by the workspace actions reference the actors, so the
    // fixture users are removed only after their trail is.
    const users = await prisma.user.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.opportunity.deleteMany({
      where: { createdByUserId: { in: userIds } },
    });
    await prisma.organization.deleteMany({
      where: { createdById: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.country.deleteMany({ where: { id: ids.countryId } });
  });

  it("shows an active owner an Opportunities entry when the workspace opens", async () => {
    const workspace = await getOrganizationWorkspace(
      ids.ownerId,
      ids.organizationSlug,
    );
    const navigation = organizationWorkspaceNavigation({
      organization: workspace.organization,
      membership: membershipOf(workspace),
    });
    const entry = navigation.find((item) => item.key === "opportunities");
    expect(entry).toBeDefined();
    expect(entry?.state).toBe("enabled");
    // Reached from the navigation, not by knowing the URL.
    expect(entry?.href).toBe(
      `/organizations/${ids.organizationSlug}/opportunities`,
    );
    expect(navigation.find((item) => item.key === "applications")?.href).toBe(
      `/organizations/${ids.organizationSlug}/opportunities/applications`,
    );
  });

  it("runs create, list, edit and publish entirely from workspace entry points", async () => {
    const created = await draftFor(
      ids.ownerId,
      ids.organizationId,
      "SCHOLARSHIP",
      "Discoverable Masters Scholarship",
    );
    const drafts = await listOrganizationOpportunities({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
    });
    const listed = drafts.find((item) => item.id === created.id);
    // A new record always starts as a draft and is immediately in the list the
    // workspace shows, so the Drafts view has something to open.
    expect(listed?.lifecycle).toBe("DRAFT");

    // The list row's Edit action resolves without any extra lookup.
    const editable = await getOrganizationOpportunityForEdit({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
    });
    expect(editable.title).toBe("Discoverable Masters Scholarship");

    const published = await transitionOrganizationOpportunity({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
      action: "PUBLISH",
    });
    expect(published.lifecycle).toBe("PUBLISHED");
  });

  it("routes a published record into its own Student Hub category", async () => {
    const cases = [
      ["INTERNSHIP", "internships", "Discoverable Summer Internship"],
      ["PART_TIME_JOB", "jobs", "Discoverable Campus Job"],
      ["RESEARCH_OPPORTUNITY", "programs", "Discoverable Lab Placement"],
    ] as const;

    for (const [type, sectionKey, title] of cases) {
      const created = await draftFor(
        ids.ownerId,
        ids.organizationId,
        type,
        title,
      );
      await transitionOrganizationOpportunity({
        userId: ids.ownerId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      });

      const results = await searchOpportunities({
        types: studentHubSectionTypes(sectionKey),
        limit: 24,
      });
      expect(results.items.map((item) => item.id)).toContain(created.id);

      // And it must not leak into a section it does not belong to.
      const others = (
        ["scholarships", "internships", "jobs", "programs"] as const
      ).filter((key) => key !== sectionKey);
      for (const otherKey of others) {
        const otherResults = await searchOpportunities({
          types: studentHubSectionTypes(otherKey),
          limit: 24,
        });
        expect(otherResults.items.map((item) => item.id)).not.toContain(
          created.id,
        );
      }
    }
  });

  it("keeps a published scholarship in the Scholarships section only", async () => {
    const scholarships = await searchOpportunities({
      types: studentHubSectionTypes("scholarships"),
      limit: 24,
    });
    expect(
      scholarships.items.every((item) => item.typeLabel === "Scholarship"),
    ).toBe(true);
  });

  it("reaches the organization application queue without an opportunity id", async () => {
    const applications = await listOrganizationApplications({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
    });
    // Empty is a valid answer; reachability is what is under test.
    expect(Array.isArray(applications)).toBe(true);
  });

  it("reaches the applicant's own application list from the Student Hub", async () => {
    const applications = await listApplicationsForApplicant(ids.applicantId);
    expect(Array.isArray(applications)).toBe(true);
  });

  it("shows a setup-required state instead of hiding the route", async () => {
    const workspace = await getOrganizationWorkspace(
      ids.ownerId,
      ids.barelySetUpSlug,
    );
    const membership = membershipOf(workspace);
    const navigation = organizationWorkspaceNavigation({
      organization: workspace.organization,
      membership,
    });
    const entry = navigation.find((item) => item.key === "opportunities");
    expect(entry).toBeDefined();
    expect(entry?.state).toBe("setup");

    const setup = opportunitySetupState({
      organization: workspace.organization,
      membership,
      profileComplete: workspace.completeness.missing.length === 0,
    });
    expect(setup.canCreateDraft).toBe(false);
    expect(setup.blockedReason).toMatch(/Scholarships or Internships/);
    expect(
      setup.requirements.find((item) => item.key === "capability")?.actionHref,
    ).toBe(`/organizations/${ids.barelySetUpSlug}/settings`);
  });

  it("refuses a capability-less organization at the service, not only in the UI", async () => {
    await expect(
      draftFor(
        ids.ownerId,
        ids.barelySetUpId,
        "SCHOLARSHIP",
        "Should never exist",
      ),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("blocks a non-member reaching the workspace by direct URL", async () => {
    await expect(
      getOrganizationWorkspace(ids.outsiderId, ids.organizationSlug),
    ).rejects.toThrow();
    await expect(
      listOrganizationOpportunities({
        userId: ids.outsiderId,
        organizationId: ids.organizationId,
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("denies an editor the application queue the navigation already hides", async () => {
    const workspace = await getOrganizationWorkspace(
      ids.editorId,
      ids.organizationSlug,
    );
    const membership = membershipOf(workspace);
    expect(
      hasOrganizationPermission(membership, "ORGANIZATION_VIEW_APPLICATIONS"),
    ).toBe(false);
    // Navigation visibility is not authorization: the service refuses too.
    await expect(
      listOrganizationApplications({
        userId: ids.editorId,
        organizationId: ids.organizationId,
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("revokes workspace access as soon as a membership ends", async () => {
    const temporaryId = await makeUser("temporary");
    await prisma.organizationMembership.create({
      data: {
        organizationId: ids.organizationId,
        userId: temporaryId,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    await expect(
      getOrganizationWorkspace(temporaryId, ids.organizationSlug),
    ).resolves.toBeDefined();

    await prisma.organizationMembership.updateMany({
      where: { organizationId: ids.organizationId, userId: temporaryId },
      data: { status: "REMOVED" },
    });
    await expect(
      listOrganizationOpportunities({
        userId: temporaryId,
        organizationId: ids.organizationId,
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("keeps nested opportunity routes under the right navigation entry", async () => {
    const workspace = await getOrganizationWorkspace(
      ids.ownerId,
      ids.organizationSlug,
    );
    const navigation = organizationWorkspaceNavigation({
      organization: workspace.organization,
      membership: membershipOf(workspace),
    });
    const base = `/organizations/${ids.organizationSlug}/opportunities`;
    expect(activeWorkspaceNavigationKey(navigation, `${base}/new`)).toBe(
      "opportunities",
    );
    expect(
      activeWorkspaceNavigationKey(navigation, `${base}/applications`),
    ).toBe("applications");
  });

  it("surfaces legacy ScholarshipAgent-era records in the unified experience", async () => {
    const legacy = await listLegacyScholarshipCards({ limit: 24 });
    const record = legacy.find((item) => item.id === ids.legacyScholarshipId);
    expect(record).toBeDefined();
    // Same public shape as any other scholarship: a real publisher name.
    expect(record?.provider).toBe("Provincial Education Bureau");
    expect(record?.typeLabel).toBe("Scholarship");
    expect(record?.href).toContain("/student-hub/scholarships/");
  });

  it("never returns a legacy scholarship twice, or beside its unified twin", async () => {
    const legacy = await listLegacyScholarshipCards({ limit: 24 });
    const seen = legacy.map((item) => item.id);
    expect(new Set(seen).size).toBe(seen.length);

    // Claim the legacy row with a unified record and it must disappear.
    const claim = await prisma.opportunity.create({
      data: {
        slug: `claim-${randomUUID().slice(0, 8)}`,
        type: "SCHOLARSHIP",
        lifecycle: "PUBLISHED",
        publisherType: "ORGANIZATION",
        publisherOrganizationId: ids.organizationId,
        createdByUserId: ids.ownerId,
        title: "Migrated Provincial Scholarship",
        shortDescription: "The unified counterpart of the legacy record.",
        description: "The unified counterpart of the legacy record.",
        applicationMethod: "EXTERNAL_URL",
        externalApplicationUrl: "https://example.edu/apply",
        publishedAt: new Date(),
        legacySourceKey: `legacy-scholarship:${ids.legacyScholarshipId}`,
      },
      select: { id: true },
    });
    try {
      const deduplicated = await listLegacyScholarshipCards({ limit: 24 });
      expect(deduplicated.map((item) => item.id)).not.toContain(
        ids.legacyScholarshipId,
      );
    } finally {
      await prisma.opportunity.delete({ where: { id: claim.id } });
    }
  });

  it("creates no scholarship record beyond the ones under test", async () => {
    // Guards against a seeded or invented example scholarship slipping in.
    const invented = await prisma.scholarship.count({
      where: {
        title: {
          in: [
            "Chinese Government Scholarship",
            "International Student Excellence Scholarship",
            "Technology Scholarship",
          ],
        },
      },
    });
    expect(invented).toBe(0);
  });
});
