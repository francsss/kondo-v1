import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubDetailsEditor } from "@/components/features/admin/CityHubDetailsEditor";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ExploreCity } from "@/features/explore/types";
import { getAdminCityHub } from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin city hub details" };

export default async function AdminCityHubDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("CITY_CMS_VIEW");
  const hub = await getAdminCityHub(user, (await params).id);
  if (!hub) notFound();
  const draft = hub.draft as unknown as ExploreCity;
  const details = {
    slug: draft.slug,
    name: draft.name,
    province: draft.province,
    country: draft.country,
    eyebrow: draft.eyebrow,
    title: draft.title,
    tagline: draft.tagline,
    summary: draft.summary,
    description: draft.description,
    signals: draft.signals,
    impactPoints: draft.impactPoints,
  };

  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/admin/city-hubs/${hub.id}`}>
          <ArrowLeft className="h-4 w-4" /> {hub.name} management areas
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="Edit the city identity without resaving any content section."
          eyebrow={`City Hub · ${hub.status}`}
          title={`${hub.name} details`}
        />
      </div>
      <AdminNav currentPath="/admin/city-hubs" role={user.role} />
      <CityHubDetailsEditor
        details={details}
        hubId={hub.id}
        key={hub.version}
        status={hub.status}
        version={hub.version}
      />
    </div>
  );
}
