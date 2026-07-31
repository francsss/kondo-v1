import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { OpportunityWorkspaceNav } from "@/components/features/opportunities/OpportunityWorkspaceNav";
import { ClampedTitle } from "@/components/ui/ClampedText";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { listOrganizationApplications } from "@/lib/opportunity-application-review";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};
// Applicant data is never cached: always rendered for one authorized reviewer.
export const dynamic = "force-dynamic";

/**
 * Every application submitted to this organization, across all of its
 * opportunities. Reaching a reviewer's queue previously required knowing an
 * opportunity id, which made the whole review workflow undiscoverable.
 */
export default async function OrganizationApplicationsWorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const workspace = await getOrganizationWorkspace(user.id, slug).catch(
    () => null,
  );
  if (!workspace) notFound();

  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  // The service re-checks ORGANIZATION_VIEW_APPLICATIONS and throws 403, which
  // is exactly what an EDITOR hits even though the entry is hidden for them.
  if (
    !hasOrganizationPermission(membership, "ORGANIZATION_VIEW_APPLICATIONS")
  ) {
    return (
      <section>
        <h2 className="text-2xl font-black tracking-tight">Applications</h2>
        <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
          <h3 className="text-lg font-black">
            Your membership cannot review applications
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Reading applicant answers and documents requires an explicit grant.
            An organization owner or admin can change your role in Team.
          </p>
        </div>
      </section>
    );
  }

  const applications = await listOrganizationApplications({
    userId: user.id,
    organizationId: workspace.organization.id,
  });

  return (
    <section>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
          Review
        </p>
        <h2 className="mt-1 text-2xl font-black tracking-tight">
          Applications
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Applications submitted to {workspace.organization.publicName} through
          Kondo.
        </p>
      </div>

      <OpportunityWorkspaceNav
        canViewApplications
        slug={slug}
        view="applications"
      />

      {applications.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
          <h3 className="text-lg font-black">No applications yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Applications appear here once an opportunity that accepts Kondo
            applications receives its first submission.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {applications.map((application) => (
            <li key={application.id}>
              <Link
                className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-5 transition hover:border-foreground/20 sm:flex-row sm:items-center sm:justify-between"
                href={`/organizations/${slug}/opportunities/applications/${application.id}`}
              >
                <div className="min-w-0">
                  <ClampedTitle className="block font-black leading-snug">
                    {application.applicantName ?? "Applicant"}
                  </ClampedTitle>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {application.opportunity.title} · {application.statusLabel}
                    {application.documentCount
                      ? ` · ${application.documentCount} document${
                          application.documentCount === 1 ? "" : "s"
                        }`
                      : ""}
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
