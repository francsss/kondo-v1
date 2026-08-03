import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestCountry } from "../helpers/reference-data";
import {
  jobDetailSchema,
  opportunityDraftSchema,
  scholarshipDetailSchema,
} from "@/features/opportunities/schemas";
import { getPublicOpportunityBySlug } from "@/lib/opportunities";
import {
  createOrganizationOpportunity,
  listOrganizationOpportunities,
  transitionOrganizationOpportunity,
} from "@/lib/opportunity-management";
import { OpportunityAccessError } from "@/lib/opportunity-permissions";
import { searchOpportunities } from "@/lib/opportunity-search";
import { opportunityWorkspaceActions } from "@/lib/opportunity-workspace-actions";
import { prisma } from "@/lib/prisma";
import { studentHubSectionTypes } from "@/lib/student-hub-sections";

/**
 * The reported failure: an organization can start a scholarship or opportunity
 * but publishing is blocked or fails with no clear explanation.
 */

const isolated =
  process.env.DATABASE_URL?.includes("/kondo_module3_test") ?? false;
const postgresDescribe = isolated ? describe.sequential : describe.skip;
const domain = "publishing.test";

let ids: {
  ownerId: string;
  editorId: string;
  viewerId: string;
  outsiderId: string;
  organizationId: string;
  otherOrganizationId: string;
  suspendedId: string;
  noCapabilityId: string;
  countryId: string;
};

async function makeUser(prefix: string) {
  const user = await prisma.user.create({
    data: {
      email: `${prefix}-${randomUUID()}@${domain}`,
      passwordHash: "x".repeat(60),
      firstName: prefix,
      lastName: "Tester",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  return user.id;
}

type DraftType =
  "SCHOLARSHIP" | "INTERNSHIP" | "PART_TIME_JOB" | "RESEARCH_OPPORTUNITY";

async function createDraft(input: {
  userId: string;
  organizationId: string;
  type: DraftType;
  title: string;
}) {
  const draft = opportunityDraftSchema.parse({
    type: input.type,
    title: input.title,
    shortDescription: `${input.title} short description for the publishing test.`,
    description: `${input.title} full description, long enough to satisfy the fifty character minimum validation rule.`,
    applicationMethod: "EXTERNAL_URL",
    externalApplicationUrl: "https://example.edu/apply",
    officialSourceUrl: "https://example.edu/official",
    applicationDeadline: new Date(Date.now() + 60 * 86_400_000),
  });
  return createOrganizationOpportunity({
    userId: input.userId,
    organizationId: input.organizationId,
    draft,
    scholarship:
      input.type === "SCHOLARSHIP"
        ? scholarshipDetailSchema.parse({ fundingType: "FULLY_FUNDED" })
        : null,
    job:
      input.type === "SCHOLARSHIP"
        ? null
        : jobDetailSchema.parse({
            employmentType:
              input.type === "INTERNSHIP"
                ? "INTERNSHIP"
                : input.type === "PART_TIME_JOB"
                  ? "PART_TIME"
                  : "RESEARCH_ASSISTANT",
          }),
  });
}

async function makeOrganization(input: {
  ownerId: string;
  slug: string;
  capabilities: string[];
  lifecycleStatus?: string;
  members?: Array<{ userId: string; role: string }>;
}) {
  const organization = await prisma.organization.create({
    data: {
      slug: input.slug,
      publicName: `Org ${input.slug}`,
      type: "COMPANY",
      lifecycleStatus: (input.lifecycleStatus ?? "ACTIVE") as never,
      publicProfileStatus: "PUBLISHED",
      createdById: input.ownerId,
      countryId: ids?.countryId,
      capabilities: {
        create: input.capabilities.map((key) => ({
          key: key as never,
          status: "ENABLED" as const,
        })),
      },
      memberships: {
        create: [
          { userId: input.ownerId, role: "OWNER", status: "ACTIVE" },
          ...(input.members ?? []).map((member) => ({
            userId: member.userId,
            role: member.role as never,
            status: "ACTIVE" as const,
          })),
        ],
      },
    },
    select: { id: true },
  });
  return organization.id;
}

postgresDescribe("opportunity publishing (postgres)", () => {
  beforeAll(async () => {
    const country = await createTestCountry(prisma, {
      name: `Publish Land ${randomUUID().slice(0, 8)}`,
    });
    const [ownerId, editorId, viewerId, outsiderId] = await Promise.all([
      makeUser("owner"),
      makeUser("editor"),
      makeUser("viewer"),
      makeUser("outsider"),
    ]);
    ids = {
      ownerId,
      editorId,
      viewerId,
      outsiderId,
      countryId: country.id,
      organizationId: "",
      otherOrganizationId: "",
      suspendedId: "",
      noCapabilityId: "",
    };
    ids.organizationId = await makeOrganization({
      ownerId,
      slug: `publish-org-${randomUUID().slice(0, 8)}`,
      capabilities: [
        "SCHOLARSHIPS",
        "INTERNSHIPS_JOBS",
        "UNIVERSITY_INFORMATION",
      ],
      members: [
        { userId: editorId, role: "EDITOR" },
        { userId: viewerId, role: "VIEWER" },
      ],
    });
    ids.otherOrganizationId = await makeOrganization({
      ownerId: outsiderId,
      slug: `other-org-${randomUUID().slice(0, 8)}`,
      capabilities: ["SCHOLARSHIPS"],
    });
    ids.suspendedId = await makeOrganization({
      ownerId,
      slug: `suspended-org-${randomUUID().slice(0, 8)}`,
      capabilities: ["SCHOLARSHIPS"],
      lifecycleStatus: "SUSPENDED",
    });
    ids.noCapabilityId = await makeOrganization({
      ownerId,
      slug: `bare-org-${randomUUID().slice(0, 8)}`,
      capabilities: ["HOUSING"],
    });
  });

  afterAll(async () => {
    const organizationIds = [
      ids.organizationId,
      ids.otherOrganizationId,
      ids.suspendedId,
      ids.noCapabilityId,
    ];
    await prisma.opportunity.deleteMany({
      where: { publisherOrganizationId: { in: organizationIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
    const users = await prisma.user.findMany({
      where: { email: { endsWith: domain } },
      select: { id: true },
    });
    const list = users.map((user) => user.id);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: list } } });
    await prisma.opportunity.deleteMany({
      where: { createdByUserId: { in: list } },
    });
    await prisma.organization.deleteMany({
      where: { createdById: { in: list } },
    });
    await prisma.user.deleteMany({ where: { id: { in: list } } });
    await prisma.country.deleteMany({ where: { id: ids.countryId } });
  });

  it("publishes each supported record type and projects it publicly", async () => {
    const cases = [
      ["SCHOLARSHIP", "scholarships"],
      ["INTERNSHIP", "internships"],
      ["PART_TIME_JOB", "jobs"],
      ["RESEARCH_OPPORTUNITY", "programs"],
    ] as const;

    for (const [type, section] of cases) {
      const created = await createDraft({
        userId: ids.ownerId,
        organizationId: ids.organizationId,
        type,
        title: `Publishable ${type} record`,
      });
      const published = await transitionOrganizationOpportunity({
        userId: ids.ownerId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      });
      expect(published.lifecycle).toBe("PUBLISHED");

      // Public page.
      const publicRecord = await getPublicOpportunityBySlug(created.slug, {});
      expect(publicRecord?.id).toBe(created.id);

      // Student Hub category projection, from the one central domain.
      const results = await searchOpportunities({
        types: studentHubSectionTypes(section),
        limit: 24,
      });
      expect(results.items.map((item) => item.id)).toContain(created.id);
    }
  });

  it("keeps a draft out of every public projection", async () => {
    const draft = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Private draft scholarship record",
    });
    expect(await getPublicOpportunityBySlug(draft.slug, {})).toBeNull();
    const results = await searchOpportunities({ limit: 24 });
    expect(results.items.map((item) => item.id)).not.toContain(draft.id);
  });

  it("removes a paused record from public projections and restores it on resume", async () => {
    const created = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Pausable scholarship record",
    });
    await transitionOrganizationOpportunity({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
      action: "PUBLISH",
    });

    await transitionOrganizationOpportunity({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
      action: "PAUSE",
    });
    expect(await getPublicOpportunityBySlug(created.slug, {})).toBeNull();

    await transitionOrganizationOpportunity({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
      action: "PUBLISH",
    });
    expect((await getPublicOpportunityBySlug(created.slug, {}))?.id).toBe(
      created.id,
    );
  });

  it("refuses a publisher trying to approve their own submission", async () => {
    const created = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Submitted for review scholarship",
    });
    await transitionOrganizationOpportunity({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      opportunityId: created.id,
      action: "SUBMIT",
    });
    await expect(
      transitionOrganizationOpportunity({
        userId: ids.ownerId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      }),
    ).rejects.toThrow(/cannot move from PENDING_REVIEW to PUBLISHED/);
  });

  it("lets an editor submit but never publish", async () => {
    const created = await createDraft({
      userId: ids.editorId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Editor authored scholarship record",
    });
    await expect(
      transitionOrganizationOpportunity({
        userId: ids.editorId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
    await expect(
      transitionOrganizationOpportunity({
        userId: ids.editorId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "SUBMIT",
      }),
    ).resolves.toBeDefined();
  });

  it("refuses a viewer any authoring action", async () => {
    await expect(
      createDraft({
        userId: ids.viewerId,
        organizationId: ids.organizationId,
        type: "SCHOLARSHIP",
        title: "Viewer should never create this",
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("refuses publishing without the matching capability", async () => {
    await expect(
      createDraft({
        userId: ids.ownerId,
        organizationId: ids.noCapabilityId,
        type: "SCHOLARSHIP",
        title: "Capability-less scholarship record",
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("refuses publishing from a suspended organization", async () => {
    const created = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.suspendedId,
      type: "SCHOLARSHIP",
      title: "Suspended organization scholarship",
    }).catch(() => null);
    // A suspension blocks publication; draft authoring may still be refused
    // earlier, and either outcome must never end in a published record.
    if (created) {
      await expect(
        transitionOrganizationOpportunity({
          userId: ids.ownerId,
          organizationId: ids.suspendedId,
          opportunityId: created.id,
          action: "PUBLISH",
        }),
      ).rejects.toBeInstanceOf(OpportunityAccessError);
    }
    const published = await prisma.opportunity.count({
      where: {
        publisherOrganizationId: ids.suspendedId,
        lifecycle: "PUBLISHED",
      },
    });
    expect(published).toBe(0);
  });

  it("blocks a cross-organization transition through a guessed id", async () => {
    const created = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Cross organization target record",
    });
    await expect(
      transitionOrganizationOpportunity({
        userId: ids.outsiderId,
        organizationId: ids.otherOrganizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("revokes authoring the moment a membership ends", async () => {
    const temporaryId = await makeUser("temporary");
    await prisma.organizationMembership.create({
      data: {
        organizationId: ids.organizationId,
        userId: temporaryId,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    const created = await createDraft({
      userId: temporaryId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Temporary member scholarship record",
    });
    await prisma.organizationMembership.updateMany({
      where: { organizationId: ids.organizationId, userId: temporaryId },
      data: { status: "REMOVED" },
    });
    await expect(
      transitionOrganizationOpportunity({
        userId: temporaryId,
        organizationId: ids.organizationId,
        opportunityId: created.id,
        action: "PUBLISH",
      }),
    ).rejects.toBeInstanceOf(OpportunityAccessError);
  });

  it("never lets the client choose the initial lifecycle", async () => {
    const created = await createDraft({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
      type: "SCHOLARSHIP",
      title: "Client controlled status attempt",
    });
    const row = await prisma.opportunity.findUnique({
      where: { id: created.id },
      select: { lifecycle: true },
    });
    expect(row?.lifecycle).toBe("DRAFT");
  });

  it("rejects an unsafe external application URL before it reaches the domain", () => {
    const parsed = opportunityDraftSchema.safeParse({
      type: "SCHOLARSHIP",
      title: "Unsafe external url scholarship",
      shortDescription: "A record whose apply link uses an unsafe scheme.",
      description:
        "A record whose apply link uses an unsafe scheme and must never be accepted by the API.",
      applicationMethod: "EXTERNAL_URL",
      externalApplicationUrl: "javascript:alert(1)",
      officialSourceUrl: "https://example.edu/official",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.success ? "" : parsed.error.issues[0]?.message).toMatch(
      /valid https:\/\/ web address/,
    );
  });

  it("surfaces the workspace actions the member can actually take", async () => {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: ids.organizationId },
      select: {
        lifecycleStatus: true,
        capabilities: { where: { status: "ENABLED" }, select: { key: true } },
      },
    });
    const enabled = organization.capabilities.map(({ key }) => key);
    const ownerActions = opportunityWorkspaceActions({
      lifecycle: "DRAFT",
      type: "SCHOLARSHIP",
      membership: { role: "OWNER", status: "ACTIVE" },
      organizationLifecycleStatus: organization.lifecycleStatus,
      enabledCapabilities: enabled,
    });
    expect(
      ownerActions.filter((entry) => entry.available).map((e) => e.action),
    ).toContain("PUBLISH");

    const editorActions = opportunityWorkspaceActions({
      lifecycle: "DRAFT",
      type: "SCHOLARSHIP",
      membership: { role: "EDITOR", status: "ACTIVE" },
      organizationLifecycleStatus: organization.lifecycleStatus,
      enabledCapabilities: enabled,
    });
    const editorPublish = editorActions.find((e) => e.action === "PUBLISH");
    expect(editorPublish?.available).toBe(false);
    expect(editorPublish?.blockedReason).toBeTruthy();
  });

  it("shows every authored record in the workspace list", async () => {
    const list = await listOrganizationOpportunities({
      userId: ids.ownerId,
      organizationId: ids.organizationId,
    });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((item) => item.title.length > 0)).toBe(true);
  });
});
