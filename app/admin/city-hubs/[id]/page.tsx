import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubEditor } from "@/components/features/admin/CityHubEditor";
import { CityHubStatusActions } from "@/components/features/admin/CityHubStatusActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAdminCityHub } from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin city hub review" };

export default async function AdminCityHubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("CITY_CMS_VIEW");
  const hub = await getAdminCityHub(user, (await params).id);
  if (!hub) notFound();

  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/city-hubs">
          <ArrowLeft className="h-4 w-4" /> City hubs
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`Created by ${hub.createdBy.firstName} ${hub.createdBy.lastName} · /${hub.slug}`}
          eyebrow="Kondo operations"
          title={hub.name}
        />
      </div>
      <AdminNav currentPath="/admin/city-hubs" role={user.role} />

      <CityHubStatusActions
        hubId={hub.id}
        status={hub.status}
        version={hub.version}
        hasPublishedSnapshot={Boolean(hub.published)}
      />

      <Card className="mt-6">
        <h2 className="font-black text-kondo-ink dark:text-white">
          Live public snapshot
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          {hub.published
            ? `Published version is live at /explore/${hub.slug}${
                hub.publishedAt
                  ? ` (last published ${new Date(hub.publishedAt).toLocaleString()})`
                  : ""
              }.`
            : `No live snapshot. Because this city is managed by the CMS, /explore/${hub.slug} stays unavailable until publication.`}
        </p>
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={`/explore/${hub.slug}`} target="_blank">
                Open public page
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href={`/admin/city-hubs/${hub.id}/preview`}>
                <Eye className="h-4 w-4" /> Preview current draft
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <CityHubEditor
        draft={hub.draft}
        hubId={hub.id}
        status={hub.status}
        version={hub.version}
      />
    </div>
  );
}
