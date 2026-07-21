import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubView } from "@/components/features/explore/CityHubView";
import { Button } from "@/components/ui/Button";
import type { ExploreCity } from "@/features/explore/types";
import { getAdminCityHub } from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Preview City Hub draft" };

export default async function AdminCityHubPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("CITY_CMS_VIEW");
  const hub = await getAdminCityHub(user, (await params).id);
  if (!hub) notFound();

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-[1440px] px-4 pt-7 sm:px-6 lg:px-8 lg:pt-10">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/admin/city-hubs/${hub.id}`}>
            <ArrowLeft className="h-4 w-4" /> Back to editor
          </Link>
        </Button>
        <AdminNav
          currentPath={`/admin/city-hubs/${hub.id}/preview`}
          role={user.role}
        />
        <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
          Draft preview only. This content is protected and is not visible to
          public users until publication.
        </p>
      </div>
      <CityHubView city={hub.draft as unknown as ExploreCity} />
    </div>
  );
}
