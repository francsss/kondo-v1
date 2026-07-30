import { OrganizationSettingsPanel } from "@/components/organizations/OrganizationSettingsPanel";
import {
  canArchiveOrganization,
  canLeaveOrganization,
  canTransferOrganizationOwnership,
  hasOrganizationPermission,
} from "@/lib/organization-authorization";
import { listOrganizationTeam } from "@/lib/organization-invitations";
import { getPendingOwnershipTransfers } from "@/lib/organization-ownership";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const workspace = await getOrganizationWorkspace(
    user.id,
    (await params).slug,
  );
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  const canManageTeam = hasOrganizationPermission(
    membership,
    "ORGANIZATION_MANAGE_TEAM",
  );
  const [team, pendingTransfers] = await Promise.all([
    canManageTeam
      ? listOrganizationTeam(user.id, workspace.organization.id)
      : Promise.resolve({ members: [], invitations: [] }),
    getPendingOwnershipTransfers(user.id, workspace.organization.id),
  ]);
  return (
    <div>
      <h2 className="text-2xl font-black tracking-tight">Workspace settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Capabilities, ownership and organization-only access controls.
      </p>
      <div className="mt-6">
        <OrganizationSettingsPanel
          canArchive={canArchiveOrganization(membership)}
          canLeave={canLeaveOrganization(membership)}
          canManageCapabilities={hasOrganizationPermission(
            membership,
            "ORGANIZATION_MANAGE_CAPABILITIES",
          )}
          canTransfer={canTransferOrganizationOwnership(membership)}
          currentUserId={user.id}
          eligibleMembers={team.members
            .filter(
              (member) =>
                member.userId !== user.id && member.user.status === "ACTIVE",
            )
            .map((member) => ({
              userId: member.userId,
              user: {
                firstName: member.user.firstName,
                lastName: member.user.lastName,
              },
            }))}
          organization={workspace.organization}
          pendingTransfers={pendingTransfers}
          role={workspace.membership.role}
        />
      </div>
    </div>
  );
}
