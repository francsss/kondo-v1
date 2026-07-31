import { HorizontalTabs } from "@/components/ui/HorizontalTabs";

/**
 * Views inside the organization Opportunities section. Each view is a filter
 * over the one workspace list — a draft and a published record are the same
 * kind of thing at different points of one lifecycle, not separate features.
 */
export const OPPORTUNITY_WORKSPACE_VIEWS = [
  { key: "all", label: "All opportunities", lifecycles: null },
  { key: "drafts", label: "Drafts", lifecycles: ["DRAFT", "REJECTED"] },
  {
    key: "published",
    label: "Published",
    lifecycles: ["PUBLISHED", "PENDING_REVIEW", "PAUSED"],
  },
  {
    key: "closed",
    label: "Closed",
    lifecycles: ["CLOSED", "EXPIRED", "ARCHIVED"],
  },
] as const;

export type OpportunityWorkspaceView =
  (typeof OPPORTUNITY_WORKSPACE_VIEWS)[number]["key"];

export function isOpportunityWorkspaceView(
  value: string | undefined,
): value is OpportunityWorkspaceView {
  return OPPORTUNITY_WORKSPACE_VIEWS.some((view) => view.key === value);
}

export function opportunityWorkspaceLifecycles(
  view: OpportunityWorkspaceView,
): string[] | null {
  const entry = OPPORTUNITY_WORKSPACE_VIEWS.find((item) => item.key === view);
  return entry?.lifecycles ? [...entry.lifecycles] : null;
}

export function OpportunityWorkspaceNav({
  slug,
  view,
  canViewApplications,
}: {
  slug: string;
  /** "applications" marks the org-wide review queue, which is its own route. */
  view: OpportunityWorkspaceView | "applications";
  canViewApplications: boolean;
}) {
  const tabs = [
    ...OPPORTUNITY_WORKSPACE_VIEWS.map((entry) => ({
      key: entry.key,
      label: entry.label,
      href:
        entry.key === "all"
          ? `/organizations/${slug}/opportunities`
          : `/organizations/${slug}/opportunities?view=${entry.key}`,
    })),
    ...(canViewApplications
      ? [
          {
            key: "applications",
            label: "Applications",
            href: `/organizations/${slug}/opportunities/applications`,
          },
        ]
      : []),
  ];
  return (
    <HorizontalTabs
      activeKey={view}
      ariaLabel="Opportunities views"
      className="mt-5"
      tabs={tabs}
    />
  );
}
