import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrganizationPublicPage } from "@/components/organizations/OrganizationPublicPage";
import { getOrganizationPublicProfilePreviewAsAdmin } from "@/lib/organization-public-profile";
import { requireAdminPermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin organization profile preview",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminOrganizationPublicProfilePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPermission(
    "ORGANIZATION_PUBLIC_PROFILES_VIEW",
  );
  const id = (await params).id;
  const profile = await getOrganizationPublicProfilePreviewAsAdmin(actor, id);
  return (
    <main className="pb-20">
      <div className="border-b border-border bg-card px-4 py-3 sm:px-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground transition hover:text-kondo-green"
          href={`/admin/organizations/${id}`}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to organization operations
        </Link>
      </div>
      <OrganizationPublicPage organization={profile} preview />
    </main>
  );
}
