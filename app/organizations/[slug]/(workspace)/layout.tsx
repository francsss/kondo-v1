import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { OrganizationWorkspaceShell } from "@/components/organizations/OrganizationWorkspaceShell";
import { getUnreadMessageCount } from "@/lib/messaging";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { OrganizationAccessError } from "@/lib/organization-permissions";
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
  return (
    <AppShell
      user={{ ...user, notificationUnreadCount, messageUnreadCount }}
      workspaces={workspaces}
    >
      <OrganizationWorkspaceShell
        organization={workspace.organization}
        role={workspace.membership.role}
      >
        {children}
      </OrganizationWorkspaceShell>
    </AppShell>
  );
}
