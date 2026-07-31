import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import {
  OrganizationWorkspaceShell,
  type WorkspaceHeroAction,
} from "@/components/organizations/OrganizationWorkspaceShell";
import { getUnreadMessageCount } from "@/lib/messaging";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { hasOrganizationPermission } from "@/lib/organization-authorization";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import {
  opportunitySetupState,
  organizationWorkspaceNavigation,
} from "@/lib/organization-workspace-navigation";
import {
  getOrganizationWorkspace,
  listOrganizationWorkspaces,
} from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const slug = (await params).slug;
  let workspace;
  try {
    workspace = await getOrganizationWorkspace(user.id, slug);
  } catch (error) {
    if (
      error instanceof OrganizationAccessError &&
      error.status === 308 &&
      error.message.startsWith("ORGANIZATION_MOVED:")
    ) {
      redirect(
        `/organizations/${error.message.slice("ORGANIZATION_MOVED:".length)}/dashboard`,
      );
    }
    notFound();
  }
  const [notificationUnreadCount, messageUnreadCount, workspaces] =
    await Promise.all([
      getUnreadNotificationCount(user.id),
      getUnreadMessageCount(user.id),
      listOrganizationWorkspaces(user.id),
    ]);

  // Navigation and hero actions resolve from the same membership the server
  // routes enforce, so the workspace never offers an action that answers 403.
  const membership = {
    role: workspace.membership.storedRole,
    status: workspace.membership.status,
  };
  const navigation = organizationWorkspaceNavigation({
    organization: workspace.organization,
    membership,
  });
  const setup = opportunitySetupState({
    organization: workspace.organization,
    membership,
    profileComplete: workspace.completeness.missing.length === 0,
  });

  const actions: WorkspaceHeroAction[] = [];
  if (workspace.organization.publicProfileStatus === "PUBLISHED") {
    actions.push({
      label: "View public page",
      href: `/organizations/${slug}`,
      variant: "secondary",
    });
  }
  if (setup.canCreateDraft) {
    actions.push({
      label: "Create opportunity",
      href: `/organizations/${slug}/opportunities/new`,
      variant: "primary",
    });
  } else if (
    hasOrganizationPermission(membership, "ORGANIZATION_EDIT_PROFILE") &&
    workspace.completeness.missing.length > 0
  ) {
    actions.push({
      label: "Continue setup",
      href: `/organizations/${slug}/profile`,
      variant: "primary",
    });
  }

  return (
    <AppShell
      organizationWorkspace={{
        slug,
        publicName: workspace.organization.publicName,
        navigation,
      }}
      user={{ ...user, notificationUnreadCount, messageUnreadCount }}
      workspaces={workspaces}
    >
      <OrganizationWorkspaceShell
        actions={actions}
        navigation={navigation}
        organization={workspace.organization}
        role={workspace.membership.role}
      >
        {children}
      </OrganizationWorkspaceShell>
    </AppShell>
  );
}
