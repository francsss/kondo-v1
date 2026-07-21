import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, Settings2 } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CityHubStatusActions } from "@/components/features/admin/CityHubStatusActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import type { ExploreCity } from "@/features/explore/types";
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
  const draft = hub.draft as unknown as ExploreCity;

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

      <section className="mt-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
            Independent management areas
          </p>
          <h2 className="mt-2 text-2xl font-black text-kondo-ink dark:text-white">
            Choose what you want to manage
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            Every section and every entry is saved separately. Opening one area
            does not require completing or resaving another.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Link href={`/admin/city-hubs/${hub.id}/details`}>
            <Card className="h-full transition hover:border-kondo-green/40 hover:shadow-lift">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                    <Settings2 className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 font-black text-kondo-ink dark:text-white">
                    Hub details
                  </h3>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    City identity, introduction, signals, and impact points.
                  </p>
                </div>
                <ArrowRight className="mt-2 h-5 w-5 text-slate-300" />
              </div>
            </Card>
          </Link>

          {draft.sections.map((section) => (
            <Link
              href={`/admin/city-hubs/${hub.id}/sections/${section.slug}`}
              key={section.slug}
            >
              <Card className="h-full transition hover:border-kondo-green/40 hover:shadow-lift">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-kondo-green">
                      {section.eyebrow}
                    </p>
                    <h3 className="mt-2 font-black text-kondo-ink dark:text-white">
                      {section.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                      {section.summary}
                    </p>
                    <p className="mt-4 text-xs font-bold text-slate-400">
                      {section.entries.length} entries
                    </p>
                  </div>
                  <ArrowRight className="mt-2 h-5 w-5 shrink-0 text-slate-300" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
