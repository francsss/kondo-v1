import { describe, expect, it } from "vitest";
import type { OrganizationMembershipContext } from "@/lib/organization-authorization";
import {
  activeWorkspaceNavigationKey,
  opportunitySetupState,
  organizationHasOpportunityCapability,
  organizationWorkspaceNavigation,
} from "@/lib/organization-workspace-navigation";

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
const removed: OrganizationMembershipContext = {
  role: "OWNER",
  status: "REMOVED",
};

function organization(
  overrides: Partial<{
    slug: string;
    lifecycleStatus: string;
    capabilities: Array<{ key: string; status: string }>;
  }> = {},
) {
  return {
    slug: "kondo-university",
    lifecycleStatus: "ACTIVE",
    capabilities: [{ key: "SCHOLARSHIPS", status: "ENABLED" }],
    ...overrides,
  };
}

function keys(items: ReturnType<typeof organizationWorkspaceNavigation>) {
  return items.map((item) => item.key);
}

describe("organization workspace navigation", () => {
  it("gives an active owner a visible Opportunities entry placed after Housing", () => {
    const items = organizationWorkspaceNavigation({
      organization: organization({
        capabilities: [
          { key: "HOUSING", status: "ENABLED" },
          { key: "SCHOLARSHIPS", status: "ENABLED" },
        ],
      }),
      membership: owner,
    });
    const order = keys(items);
    expect(order).toContain("opportunities");
    expect(order.indexOf("opportunities")).toBe(order.indexOf("housing") + 1);
  });

  it("links Opportunities at the active organization slug", () => {
    const items = organizationWorkspaceNavigation({
      organization: organization({ slug: "lagos-scholars" }),
      membership: owner,
    });
    expect(items.find((item) => item.key === "opportunities")?.href).toBe(
      "/organizations/lagos-scholars/opportunities",
    );
  });

  it("keeps Opportunities visible in a setup state when no capability is enabled", () => {
    const items = organizationWorkspaceNavigation({
      organization: organization({ capabilities: [] }),
      membership: owner,
    });
    const entry = items.find((item) => item.key === "opportunities");
    // Visible, not silently absent: a hidden entry cannot be fixed by the
    // person who is supposed to fix it.
    expect(entry).toBeDefined();
    expect(entry?.state).toBe("setup");
    expect(entry?.setupReason).toMatch(/Scholarships|Internships/);
  });

  it("treats either opportunity capability as sufficient", () => {
    expect(
      organizationHasOpportunityCapability(
        organization({
          capabilities: [{ key: "INTERNSHIPS_JOBS", status: "ENABLED" }],
        }),
      ),
    ).toBe(true);
    expect(
      organizationHasOpportunityCapability(
        organization({
          capabilities: [{ key: "SCHOLARSHIPS", status: "DISABLED" }],
        }),
      ),
    ).toBe(false);
  });

  it("hides Applications from an editor, who holds no applicant access", () => {
    expect(
      keys(
        organizationWorkspaceNavigation({
          organization: organization(),
          membership: editor,
        }),
      ),
    ).not.toContain("applications");
    expect(
      keys(
        organizationWorkspaceNavigation({
          organization: organization(),
          membership: owner,
        }),
      ),
    ).toContain("applications");
  });

  it("still shows a viewer the Opportunities entry they may read", () => {
    const order = keys(
      organizationWorkspaceNavigation({
        organization: organization(),
        membership: viewer,
      }),
    );
    expect(order).toContain("opportunities");
    expect(order).not.toContain("applications");
    expect(order).not.toContain("team");
  });

  it("offers a removed member nothing beyond the dashboard shell", () => {
    const order = keys(
      organizationWorkspaceNavigation({
        organization: organization(),
        membership: removed,
      }),
    );
    expect(order).not.toContain("opportunities");
    expect(order).not.toContain("applications");
  });

  it("does not present organization opportunities as personal opportunities", () => {
    const items = organizationWorkspaceNavigation({
      organization: organization(),
      membership: owner,
    });
    for (const item of items) {
      expect(item.href.startsWith("/organizations/")).toBe(true);
      expect(item.href.startsWith("/opportunities")).toBe(false);
      expect(item.href.startsWith("/student-hub")).toBe(false);
    }
  });

  it("keeps exactly four organization actions in the mobile primary bar", () => {
    const items = organizationWorkspaceNavigation({
      organization: organization({
        capabilities: [
          { key: "HOUSING", status: "ENABLED" },
          { key: "SCHOLARSHIPS", status: "ENABLED" },
          { key: "PRODUCTS", status: "ENABLED" },
          { key: "STUDENT_SERVICES", status: "ENABLED" },
        ],
      }),
      membership: owner,
    });
    expect(
      items
        .filter(({ primaryOnMobile }) => primaryOnMobile)
        .map(({ key }) => key),
    ).toEqual(["dashboard", "housing", "opportunities", "applications"]);
    expect(keys(items)).toEqual(
      expect.arrayContaining(["products", "services"]),
    );
  });
});

describe("active workspace navigation state", () => {
  const items = organizationWorkspaceNavigation({
    organization: organization(),
    membership: owner,
  });

  it("keeps Opportunities active on nested create and edit routes", () => {
    expect(
      activeWorkspaceNavigationKey(
        items,
        "/organizations/kondo-university/opportunities/new",
      ),
    ).toBe("opportunities");
    expect(
      activeWorkspaceNavigationKey(
        items,
        "/organizations/kondo-university/opportunities/abc/edit",
      ),
    ).toBe("opportunities");
  });

  it("prefers the more specific Applications entry over its shared prefix", () => {
    expect(
      activeWorkspaceNavigationKey(
        items,
        "/organizations/kondo-university/opportunities/applications",
      ),
    ).toBe("applications");
    expect(
      activeWorkspaceNavigationKey(
        items,
        "/organizations/kondo-university/opportunities/applications/xyz",
      ),
    ).toBe("applications");
  });

  it("keeps a per-opportunity application list under Opportunities", () => {
    expect(
      activeWorkspaceNavigationKey(
        items,
        "/organizations/kondo-university/opportunities/abc/applications",
      ),
    ).toBe("opportunities");
  });
});

describe("opportunity setup state", () => {
  it("clears every requirement for a configured active owner", () => {
    const state = opportunitySetupState({
      organization: organization(),
      membership: owner,
      profileComplete: true,
    });
    expect(state.requirements.every((item) => item.met)).toBe(true);
    expect(state.canCreateDraft).toBe(true);
    expect(state.canPublish).toBe(true);
    expect(state.blockedReason).toBeNull();
  });

  it("names the missing capability and offers a direct configuration action", () => {
    const state = opportunitySetupState({
      organization: organization({ capabilities: [] }),
      membership: owner,
      profileComplete: true,
    });
    const capability = state.requirements.find(
      (item) => item.key === "capability",
    );
    expect(capability?.met).toBe(false);
    expect(capability?.actionHref).toBe(
      "/organizations/kondo-university/settings",
    );
    expect(state.canCreateDraft).toBe(false);
    expect(state.blockedReason).toMatch(/Scholarships or Internships/);
  });

  it("allows draft creation while the profile is still incomplete", () => {
    const state = opportunitySetupState({
      organization: organization(),
      membership: owner,
      profileComplete: false,
    });
    // Blocking drafts would only prevent the work that completes setup.
    expect(state.canCreateDraft).toBe(true);
    expect(state.requirements.find((item) => item.key === "profile")?.met).toBe(
      false,
    );
  });

  it("blocks publication for a suspended organization and explains why", () => {
    const state = opportunitySetupState({
      organization: {
        ...organization({ lifecycleStatus: "SUSPENDED" }),
        suspensionReason: "Under moderation review.",
      },
      membership: owner,
      profileComplete: true,
    });
    expect(state.canPublish).toBe(false);
    expect(state.canCreateDraft).toBe(false);
    expect(state.blockedReason).toBe("Under moderation review.");
  });

  it("separates the create permission from the publish permission", () => {
    const state = opportunitySetupState({
      organization: organization(),
      membership: editor,
      profileComplete: true,
    });
    // EDITOR may author and submit, but never publish on its own.
    expect(state.canCreateDraft).toBe(true);
    expect(state.canPublish).toBe(false);
  });

  it("refuses draft creation for a viewer and says so", () => {
    const state = opportunitySetupState({
      organization: organization(),
      membership: viewer,
      profileComplete: true,
    });
    expect(state.canCreateDraft).toBe(false);
    expect(state.blockedReason).toMatch(/permission to create/);
  });
});
