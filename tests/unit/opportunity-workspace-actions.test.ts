import { describe, expect, it } from "vitest";
import type { OrganizationMembershipContext } from "@/lib/organization-authorization";
import { canTransitionOpportunity } from "@/lib/opportunity-lifecycle";
import {
  opportunityLifecycleGuidance,
  opportunityWorkspaceActions,
} from "@/lib/opportunity-workspace-actions";

const owner: OrganizationMembershipContext = {
  role: "OWNER",
  status: "ACTIVE",
};
const editor: OrganizationMembershipContext = {
  role: "EDITOR",
  status: "ACTIVE",
};
const viewer: OrganizationMembershipContext = {
  role: "VIEWER",
  status: "ACTIVE",
};

function actions(
  overrides: Partial<Parameters<typeof opportunityWorkspaceActions>[0]> = {},
) {
  return opportunityWorkspaceActions({
    lifecycle: "DRAFT",
    type: "SCHOLARSHIP",
    membership: owner,
    organizationLifecycleStatus: "ACTIVE",
    enabledCapabilities: ["SCHOLARSHIPS"],
    ...overrides,
  });
}

const keys = (list: ReturnType<typeof actions>) =>
  list.map((entry) => entry.action);
const available = (list: ReturnType<typeof actions>) =>
  list.filter((entry) => entry.available).map((entry) => entry.action);
const find = (list: ReturnType<typeof actions>, action: string) =>
  list.find((entry) => entry.action === action);

describe("lifecycle transitions", () => {
  it("allows the documented publisher transitions", () => {
    const publisher = (from: string, to: string) =>
      canTransitionOpportunity({
        actor: "PUBLISHER",
        from: from as never,
        to: to as never,
      });
    expect(publisher("DRAFT", "PENDING_REVIEW")).toBe(true);
    expect(publisher("PUBLISHED", "PAUSED")).toBe(true);
    expect(publisher("PAUSED", "PUBLISHED")).toBe(true);
    expect(publisher("PUBLISHED", "ARCHIVED")).toBe(true);
  });

  it("reserves review outcomes for a moderator", () => {
    const moderator = (from: string, to: string) =>
      canTransitionOpportunity({
        actor: "MODERATOR",
        from: from as never,
        to: to as never,
      });
    expect(moderator("PENDING_REVIEW", "PUBLISHED")).toBe(true);
    expect(moderator("PENDING_REVIEW", "REJECTED")).toBe(true);
    // A publisher must never approve their own submission.
    expect(
      canTransitionOpportunity({
        actor: "PUBLISHER",
        from: "PENDING_REVIEW",
        to: "PUBLISHED",
      }),
    ).toBe(false);
  });

  it("refuses invalid direct jumps", () => {
    for (const [from, to] of [
      ["DRAFT", "PAUSED"],
      ["ARCHIVED", "PUBLISHED"],
      ["REMOVED", "PUBLISHED"],
      ["CLOSED", "PUBLISHED"],
    ] as const) {
      expect(canTransitionOpportunity({ actor: "PUBLISHER", from, to })).toBe(
        false,
      );
    }
  });
});

describe("workspace lifecycle actions", () => {
  it("offers a configured owner both submit and direct publish on a draft", () => {
    const list = actions();
    expect(available(list)).toContain("SUBMIT");
    expect(available(list)).toContain("PUBLISH");
    expect(available(list)).toContain("ARCHIVE");
  });

  it("offers pause and archive on a published record, never publish again", () => {
    const list = actions({ lifecycle: "PUBLISHED" });
    expect(keys(list)).toContain("PAUSE");
    expect(keys(list)).toContain("ARCHIVE");
    expect(keys(list)).not.toContain("PUBLISH");
  });

  it("offers resume on a paused record", () => {
    expect(available(actions({ lifecycle: "PAUSED" }))).toContain("PUBLISH");
  });

  it("offers a publisher nothing to approve while a record is in review", () => {
    const list = actions({ lifecycle: "PENDING_REVIEW" });
    expect(keys(list)).not.toContain("PUBLISH");
    expect(opportunityLifecycleGuidance("PENDING_REVIEW")).toMatch(
      /Awaiting moderation review/,
    );
  });

  it("tells an editor exactly why publishing is unavailable", () => {
    const publish = find(actions({ membership: editor }), "PUBLISH");
    expect(publish?.available).toBe(false);
    expect(publish?.blockedReason).toBe(
      "You can edit opportunities but you do not have permission to publish them.",
    );
    // The same editor may still submit for review.
    expect(find(actions({ membership: editor }), "SUBMIT")?.available).toBe(
      true,
    );
  });

  it("blocks a viewer from every publisher action, with a reason", () => {
    const list = actions({ membership: viewer });
    expect(available(list)).toEqual([]);
    expect(list.every((entry) => entry.blockedReason)).toBe(true);
  });

  it("names the missing capability rather than refusing generically", () => {
    const publish = find(
      actions({ enabledCapabilities: ["HOUSING"] }),
      "PUBLISH",
    );
    expect(publish?.available).toBe(false);
    expect(publish?.blockedReason).toBe(
      "This organization has not enabled the Scholarships activity area.",
    );
  });

  it("names the capability an internship needs", () => {
    const publish = find(
      actions({ type: "INTERNSHIP", enabledCapabilities: ["SCHOLARSHIPS"] }),
      "PUBLISH",
    );
    expect(publish?.blockedReason).toBe(
      "This organization has not enabled the Internships & jobs activity area.",
    );
  });

  it("explains a suspension in the organization's own words", () => {
    const publish = find(
      actions({
        organizationLifecycleStatus: "SUSPENDED",
        suspensionReason: "Under moderation review.",
      }),
      "PUBLISH",
    );
    expect(publish?.available).toBe(false);
    expect(publish?.blockedReason).toBe("Under moderation review.");
  });

  it("keeps archiving available to an owner of a suspended organization", () => {
    // Archiving removes nothing public and must not be trapped by a suspension.
    expect(
      find(actions({ organizationLifecycleStatus: "SUSPENDED" }), "ARCHIVE")
        ?.available,
    ).toBe(true);
  });

  it("asks for confirmation only on irreversible actions", () => {
    const list = actions({ lifecycle: "PUBLISHED" });
    expect(find(list, "ARCHIVE")?.confirm).toBe(true);
    expect(find(list, "CLOSE")?.confirm).toBe(true);
    expect(find(list, "PAUSE")?.confirm).toBe(false);
  });

  it("offers no action at all on a removed record", () => {
    expect(actions({ lifecycle: "REMOVED" })).toEqual([]);
  });

  it("gives every lifecycle state a plain-language next step", () => {
    for (const lifecycle of [
      "DRAFT",
      "PENDING_REVIEW",
      "PUBLISHED",
      "PAUSED",
      "REJECTED",
      "CLOSED",
      "EXPIRED",
      "REMOVED",
      "ARCHIVED",
    ] as const) {
      expect(opportunityLifecycleGuidance(lifecycle)).toBeTruthy();
    }
  });
});
