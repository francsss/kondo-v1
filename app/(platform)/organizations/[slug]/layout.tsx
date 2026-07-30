import { notFound, redirect } from "next/navigation";
import { OrganizationWorkspaceShell } from "@/components/organizations/OrganizationWorkspaceShell";
import { OrganizationAccessError } from "@/lib/organization-permissions";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
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
  return (
    <OrganizationWorkspaceShell
      organization={workspace.organization}
      role={workspace.membership.role}
    >
      {children}
    </OrganizationWorkspaceShell>
  );
}
