import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Pencil, Plus } from "lucide-react";
import { OpportunityLifecycleActions } from "@/components/features/opportunities/OpportunityLifecycleActions";
import { OpportunitySetupPanel } from "@/components/features/opportunities/OpportunitySetupPanel";
import {
  isOpportunityWorkspaceView,
  OpportunityWorkspaceNav,
  opportunityWorkspaceLifecycles,
} from "@/components/features/opportunities/OpportunityWorkspaceNav";
import { Button } from "@/components/ui/Button";
import { ClampedTitle } from "@/components/ui/ClampedText";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { opportunitySetupState } from "@/lib/organization-workspace-navigation";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { opportunityLifecycleLabel } from "@/lib/opportunity-lifecycle";
import { listOrganizationOpportunities } from "@/lib/opportunity-management";
import {
  opportunityLifecycleGuidance,
  opportunityWorkspaceActions,
} from "@/lib/opportunity-workspace-actions";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Opportunities workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function OrganizationOpportunitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const workspace = await getOrganizationWorkspace(user.id, slug).catch(
    () => null,
  );
  if (!workspace) notFound();

  const { organization } = workspace;
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  const view = isOpportunityWorkspaceView(query.view) ? query.view : "all";
  const lifecycles = opportunityWorkspaceLifecycles(view);

  const setup = opportunitySetupState({
    organization,
    membership,
    profileComplete: workspace.completeness.missing.length === 0,
  });
  const canEdit = hasOrganizationPermission(
    membership,
    "ORGANIZATION_EDIT_OPPORTUNITIES",
  );
  const canViewApplications = hasOrganizationPermission(
    membership,
    "ORGANIZATION_VIEW_APPLICATIONS",
  );
  const enabledCapabilities = organization.capabilities
    .filter((capability) => capability.status === "ENABLED")
    .map((capability) => capability.key);

  // Workspace access is re-checked inside the service, which throws for a
  // removed member regardless of what the navigation offered.
  const all = await listOrganizationOpportunities({
    userId: user.id,
    organizationId: organization.id,
  });
  const opportunities = lifecycles
    ? all.filter((item) => lifecycles.includes(item.lifecycle))
    : all;

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Manage opportunities
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">
            Opportunities
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Scholarships, internships, jobs and programs published by{" "}
            {organization.publicName}.
          </p>
        </div>
        {setup.canCreateDraft ? (
          <Button asChild>
            <Link href={`/organizations/${slug}/opportunities/new`}>
              <Plus aria-hidden="true" className="h-4 w-4" /> Create opportunity
            </Link>
          </Button>
        ) : null}
      </div>

      <OpportunityWorkspaceNav
        canViewApplications={canViewApplications}
        slug={slug}
        view={view}
      />

      <OpportunitySetupPanel
        blockedReason={setup.blockedReason}
        requirements={setup.requirements}
      />

      {opportunities.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
          <h3 className="text-lg font-black">
            {view === "all"
              ? "No opportunities yet"
              : "Nothing in this view yet"}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {view === "all"
              ? "Publish scholarships, internships, jobs, research placements and programs so students can find them on Kondo."
              : "Opportunities appear here as they move through review, publication and closing."}
          </p>
          {setup.canCreateDraft && view === "all" ? (
            <Button asChild className="mt-5">
              <Link href={`/organizations/${slug}/opportunities/new`}>
                <Plus aria-hidden="true" className="h-4 w-4" /> Create
                opportunity
              </Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {opportunities.map((opportunity) => (
            <li
              className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition hover:border-foreground/20 sm:flex-row sm:items-center sm:justify-between"
              key={opportunity.id}
            >
              <div className="min-w-0">
                <ClampedTitle className="block font-black leading-snug">
                  {opportunity.title}
                </ClampedTitle>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {opportunity.typeLabel} ·{" "}
                  {opportunityLifecycleLabel(opportunity.lifecycle)}
                  {opportunity.deadline
                    ? ` · closes ${new Date(
                        opportunity.deadline,
                      ).toLocaleDateString("en-GB")}`
                    : ""}
                </p>
                {/* States who owns the next step, so a record waiting on
                    moderation never looks like a failed publish. */}
                {opportunityLifecycleGuidance(opportunity.lifecycle) ? (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {opportunityLifecycleGuidance(opportunity.lifecycle)}
                  </p>
                ) : null}
                <div className="mt-3">
                  <OpportunityLifecycleActions
                    actions={opportunityWorkspaceActions({
                      lifecycle: opportunity.lifecycle,
                      type: opportunity.type,
                      membership,
                      organizationLifecycleStatus: organization.lifecycleStatus,
                      enabledCapabilities,
                      suspensionReason: organization.suspensionReason,
                    })}
                    opportunityId={opportunity.id}
                    organizationId={organization.id}
                  />
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {canViewApplications ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/organizations/${slug}/opportunities/${opportunity.id}/applications`}
                    >
                      <ClipboardList aria-hidden="true" className="h-4 w-4" />
                      {opportunity.applicationCount} application
                      {opportunity.applicationCount === 1 ? "" : "s"}
                    </Link>
                  </Button>
                ) : null}
                {canEdit ? (
                  <Button asChild size="sm">
                    <Link
                      href={`/organizations/${slug}/opportunities/${opportunity.id}/edit`}
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" /> Edit
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
