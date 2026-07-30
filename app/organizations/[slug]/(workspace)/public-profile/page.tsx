import { OrganizationPublicProfileManager } from "@/components/organizations/OrganizationPublicProfileManager";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { getOrganizationPublicProfileManagement } from "@/lib/organization-public-profile";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export default async function OrganizationPublicProfileManagementPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const workspace = await getOrganizationWorkspace(
    user.id,
    (await params).slug,
  );
  const management = await getOrganizationPublicProfileManagement(
    user,
    workspace.organization.id,
  );
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  return (
    <div>
      <OrganizationPublicProfileManager
        canManageMedia={hasOrganizationPermission(
          membership,
          "ORGANIZATION_MANAGE_PUBLIC_MEDIA",
        )}
        canPublish={hasOrganizationPermission(
          membership,
          "ORGANIZATION_MANAGE_PUBLICATION",
        )}
        organization={management.organization}
        readiness={management.readiness}
      />
    </div>
  );
}
