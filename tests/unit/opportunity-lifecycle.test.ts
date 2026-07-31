import { describe, expect, it } from "vitest";
import {
  assertOpportunityTransition,
  canTransitionOpportunity,
  isActiveSearchLifecycle,
  isIndexableLifecycle,
  isPubliclyExposableLifecycle,
} from "@/lib/opportunity-lifecycle";
import {
  applicationAnswersEditable,
  canTransitionApplication,
} from "@/lib/opportunity-application-status";
import {
  canExposeOpportunityPublicly,
  canOrganizationReviewApplication,
  canUserApplyToOpportunity,
  canUserViewApplication,
} from "@/lib/opportunity-visibility";
import {
  canChangeOpportunityType,
  opportunitySupportsApplicationMethod,
  opportunitySupportsPublisher,
} from "@/lib/opportunity-types";

describe("opportunity lifecycle", () => {
  it("allows a publisher to submit and publish a draft", () => {
    expect(
      canTransitionOpportunity({
        actor: "PUBLISHER",
        from: "DRAFT",
        to: "PENDING_REVIEW",
      }),
    ).toBe(true);
    expect(
      canTransitionOpportunity({
        actor: "PUBLISHER",
        from: "PUBLISHED",
        to: "CLOSED",
      }),
    ).toBe(true);
  });

  it("refuses invalid transitions", () => {
    expect(
      canTransitionOpportunity({
        actor: "PUBLISHER",
        from: "CLOSED",
        to: "PUBLISHED",
      }),
    ).toBe(false);
    expect(() =>
      assertOpportunityTransition({
        actor: "PUBLISHER",
        from: "REMOVED",
        to: "PUBLISHED",
      }),
    ).toThrow(/cannot move/i);
  });

  it("never lets a publisher assign a moderation state", () => {
    for (const to of ["REMOVED", "REJECTED"] as const) {
      for (const from of ["DRAFT", "PUBLISHED", "PAUSED"] as const) {
        expect(canTransitionOpportunity({ actor: "PUBLISHER", from, to })).toBe(
          false,
        );
      }
    }
  });

  it("restores a removed opportunity to review rather than straight to public", () => {
    expect(
      canTransitionOpportunity({
        actor: "MODERATOR",
        from: "REMOVED",
        to: "PUBLISHED",
      }),
    ).toBe(false);
    expect(
      canTransitionOpportunity({
        actor: "MODERATOR",
        from: "REMOVED",
        to: "PENDING_REVIEW",
      }),
    ).toBe(true);
  });

  it("separates public exposure, active search and indexing", () => {
    expect(isPubliclyExposableLifecycle("CLOSED")).toBe(true);
    expect(isActiveSearchLifecycle("CLOSED")).toBe(false);
    // A closed opportunity keeps a reachable page but is never indexed.
    expect(isIndexableLifecycle("CLOSED")).toBe(false);
    expect(isIndexableLifecycle("PUBLISHED")).toBe(true);
  });
});

describe("opportunity public visibility", () => {
  const base = {
    lifecycle: "PUBLISHED" as const,
    publisherType: "ORGANIZATION" as const,
    organizationLifecycleStatus: "ACTIVE" as const,
  };

  it("exposes a published opportunity from an active organization", () => {
    expect(canExposeOpportunityPublicly(base)).toBe(true);
  });

  it("hides an opportunity when the organization is suspended", () => {
    expect(
      canExposeOpportunityPublicly({
        ...base,
        organizationLifecycleStatus: "SUSPENDED",
      }),
    ).toBe(false);
  });

  it("hides an opportunity blocked by moderation", () => {
    expect(
      canExposeOpportunityPublicly({
        ...base,
        publicationBlockedAt: new Date(),
      }),
    ).toBe(false);
  });

  it("hides an expired opportunity from active surfaces", () => {
    expect(
      canExposeOpportunityPublicly({
        ...base,
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe(false);
  });

  it("requires an active agent for a legacy publisher", () => {
    expect(
      canExposeOpportunityPublicly({
        lifecycle: "PUBLISHED",
        publisherType: "LEGACY_SCHOLARSHIP_AGENT",
        legacyAgentActive: false,
      }),
    ).toBe(false);
    expect(
      canExposeOpportunityPublicly({
        lifecycle: "PUBLISHED",
        publisherType: "LEGACY_SCHOLARSHIP_AGENT",
        legacyAgentActive: true,
      }),
    ).toBe(true);
  });
});

describe("application authorization", () => {
  it("does not reuse public visibility as permission to apply", () => {
    expect(
      canUserApplyToOpportunity({
        authenticated: true,
        applicantStatus: "ACTIVE",
        acceptsKondoApplications: false,
        publiclyVisible: true,
        hasExistingApplication: false,
      }),
    ).toBe(false);
  });

  it("blocks a duplicate application", () => {
    expect(
      canUserApplyToOpportunity({
        authenticated: true,
        applicantStatus: "ACTIVE",
        acceptsKondoApplications: true,
        publiclyVisible: true,
        hasExistingApplication: true,
      }),
    ).toBe(false);
  });

  it("only lets the applicant read their own application", () => {
    expect(
      canUserViewApplication({ viewerUserId: "a", applicantUserId: "a" }),
    ).toBe(true);
    expect(
      canUserViewApplication({ viewerUserId: "b", applicantUserId: "a" }),
    ).toBe(false);
  });

  it("requires same-organization membership plus permission to review", () => {
    expect(
      canOrganizationReviewApplication({
        applicationOrganizationId: "org-1",
        membershipOrganizationId: "org-2",
        membershipStatus: "ACTIVE",
        hasApplicationPermission: true,
      }),
    ).toBe(false);
    expect(
      canOrganizationReviewApplication({
        applicationOrganizationId: "org-1",
        membershipOrganizationId: "org-1",
        membershipStatus: "REMOVED",
        hasApplicationPermission: true,
      }),
    ).toBe(false);
    expect(
      canOrganizationReviewApplication({
        applicationOrganizationId: "org-1",
        membershipOrganizationId: "org-1",
        membershipStatus: "ACTIVE",
        hasApplicationPermission: false,
      }),
    ).toBe(false);
    expect(
      canOrganizationReviewApplication({
        applicationOrganizationId: "org-1",
        membershipOrganizationId: "org-1",
        membershipStatus: "ACTIVE",
        hasApplicationPermission: true,
      }),
    ).toBe(true);
  });
});

describe("application status machine", () => {
  it("moves a submitted application to under review", () => {
    expect(
      canTransitionApplication({
        actor: "REVIEWER",
        from: "SUBMITTED",
        to: "UNDER_REVIEW",
      }),
    ).toBe(true);
  });

  it("refuses submitted straight to offered", () => {
    expect(
      canTransitionApplication({
        actor: "REVIEWER",
        from: "SUBMITTED",
        to: "OFFERED",
      }),
    ).toBe(false);
  });

  it("does not let a rejection silently return to review", () => {
    expect(
      canTransitionApplication({
        actor: "REVIEWER",
        from: "REJECTED",
        to: "UNDER_REVIEW",
      }),
    ).toBe(false);
  });

  it("does not let an applicant shortlist or offer themselves", () => {
    for (const to of ["SHORTLISTED", "OFFERED", "UNDER_REVIEW"] as const) {
      expect(
        canTransitionApplication({
          actor: "APPLICANT",
          from: "SUBMITTED",
          to,
        }),
      ).toBe(false);
    }
  });

  it("does not let a reviewer act on a draft or a withdrawn application", () => {
    expect(
      canTransitionApplication({
        actor: "REVIEWER",
        from: "DRAFT",
        to: "UNDER_REVIEW",
      }),
    ).toBe(false);
    expect(
      canTransitionApplication({
        actor: "REVIEWER",
        from: "WITHDRAWN",
        to: "UNDER_REVIEW",
      }),
    ).toBe(false);
  });

  it("freezes answers once submitted", () => {
    expect(applicationAnswersEditable("DRAFT")).toBe(true);
    expect(applicationAnswersEditable("MORE_INFORMATION_REQUIRED")).toBe(true);
    expect(applicationAnswersEditable("SUBMITTED")).toBe(false);
    expect(applicationAnswersEditable("UNDER_REVIEW")).toBe(false);
  });
});

describe("opportunity type registry", () => {
  it("restricts publishers and application methods per type", () => {
    expect(
      opportunitySupportsPublisher("SCHOLARSHIP", "LEGACY_SCHOLARSHIP_AGENT"),
    ).toBe(true);
    expect(
      opportunitySupportsPublisher("FULL_TIME_JOB", "LEGACY_SCHOLARSHIP_AGENT"),
    ).toBe(false);
    expect(
      opportunitySupportsApplicationMethod(
        "SCHOLARSHIP",
        "NOMINATION_REQUIRED",
      ),
    ).toBe(true);
    expect(
      opportunitySupportsApplicationMethod(
        "FULL_TIME_JOB",
        "NOMINATION_REQUIRED",
      ),
    ).toBe(false);
  });

  it("refuses a structurally incompatible type change once applications exist", () => {
    expect(
      canChangeOpportunityType({
        from: "SCHOLARSHIP",
        to: "FULL_TIME_JOB",
        hasApplications: true,
      }),
    ).toBe(false);
    expect(
      canChangeOpportunityType({
        from: "SCHOLARSHIP",
        to: "FULL_TIME_JOB",
        hasApplications: false,
      }),
    ).toBe(true);
    // Same detail shape stays allowed even with applications.
    expect(
      canChangeOpportunityType({
        from: "INTERNSHIP",
        to: "PART_TIME_JOB",
        hasApplications: true,
      }),
    ).toBe(true);
  });
});
