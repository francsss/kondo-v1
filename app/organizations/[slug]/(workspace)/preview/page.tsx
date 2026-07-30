import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrganizationPublicPage } from "@/components/organizations/OrganizationPublicPage";
import { getOrganizationPublicProfilePreview } from "@/lib/organization-public-profile";
import { getOrganizationWorkspace } from "@/lib/organization-workspaces";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Organization public profile preview",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function OrganizationPublicProfilePreviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const workspace = await getOrganizationWorkspace(
    user.id,
    (await params).slug,
  );
  const profile = await getOrganizationPublicProfilePreview(
    user,
    workspace.organization.id,
  );
  return (
    <div className="-mx-4 -my-5 sm:-mx-5 sm:-my-6 lg:-mx-6">
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
          href={`/organizations/${workspace.organization.slug}/public-profile`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to public profile settings
        </Link>
      </div>
      <OrganizationPublicPage organization={profile} preview />
    </div>
  );
}
