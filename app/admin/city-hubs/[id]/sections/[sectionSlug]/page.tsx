import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubSectionEditor } from "@/components/features/admin/CityHubSectionEditor";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ExploreCity } from "@/features/explore/types";
import { getAdminCityHub } from "@/lib/city-hub";
import { requireAdminPermission } from "@/lib/server-auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin city hub section" };

export default async function AdminCityHubSectionPage({
  params,
}: {
  params: Promise<{ id: string; sectionSlug: string }>;
}) {
  const routeParams = await params;
  const user = await requireAdminPermission("CITY_CMS_VIEW");
  const hub = await getAdminCityHub(user, routeParams.id);
  if (!hub) notFound();
  const draft = hub.draft as unknown as ExploreCity;
  const section = draft.sections.find(
    (candidate) => candidate.slug === routeParams.sectionSlug,
  );
  if (!section) notFound();

  return (
    <div className="mx-auto max-w-[1120px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href={`/admin/city-hubs/${hub.id}`}>
          <ArrowLeft className="h-4 w-4" /> {hub.name} management areas
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={section.summary}
          eyebrow={`City Hub · ${hub.status}`}
          title={section.title}
        />
      </div>
      <AdminNav currentPath="/admin/city-hubs" role={user.role} />

      <nav
        aria-label="City Hub sections"
        className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-1"
      >
        {draft.sections.map((candidate) => (
          <Link
            aria-current={candidate.slug === section.slug ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border px-4 py-2 text-sm font-bold transition",
              candidate.slug === section.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-slate-200 bg-white text-muted-foreground hover:border-kondo-green hover:text-kondo-green dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground",
            )}
            href={`/admin/city-hubs/${hub.id}/sections/${candidate.slug}`}
            key={candidate.slug}
          >
            {candidate.shortTitle}
          </Link>
        ))}
      </nav>

      <CityHubSectionEditor
        hubId={hub.id}
        key={hub.version}
        section={section}
        status={hub.status}
        version={hub.version}
      />
    </div>
  );
}
