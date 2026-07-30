import { OrganizationTeamManager } from "@/components/organizations/OrganizationTeamManager";
import { listOrganizationTeam } from "@/lib/organization-invitations";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const slug = (await params).slug;
  const workspace = await getOrganizationWorkspace(user.id, slug);
  let team;
  try {
    team = await listOrganizationTeam(user.id, workspace.organization.id);
  } catch (error) {
    if (error instanceof OrganizationAccessError) {
      team = null;
    } else {
      throw error;
    }
  }
  if (!team) {
    return (
      <section className="rounded-4xl border border-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-2xl font-black">Team access is restricted</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Your organization role can view the dashboard but cannot inspect or
          manage team access.
        </p>
      </section>
    );
  }
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">Team and access</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Every teammate uses an individual Kondo account. Access changes apply
        immediately.
      </p>
      <div className="mt-6">
        <OrganizationTeamManager
          currentRole={workspace.membership.role}
          currentUserId={user.id}
          initialInvitations={team.invitations}
          initialMembers={team.members}
          organizationId={workspace.organization.id}
        />
      </div>
    </div>
  );
}
