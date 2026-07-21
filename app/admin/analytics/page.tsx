import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Flag, Search, Users } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { activeListingWhere } from "@/lib/content-visibility";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin analytics" };

const ranges = [7, 30, 90] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("ANALYTICS_VIEW");
  const requested = Number(one((await searchParams).days) ?? 30);
  const days = ranges.includes(requested as (typeof ranges)[number])
    ? requested
    : 30;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const [
    totalUsers,
    newUsers,
    activeUsers,
    activeListings,
    publishedGuides,
    publishedCities,
    reportVolume,
    eventGroups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: since } } }),
    prisma.marketplaceListing.count({ where: activeListingWhere() }),
    prisma.guide.count({ where: { published: true } }),
    prisma.cityHub.count({ where: { status: "PUBLISHED" } }),
    prisma.report.count({ where: { createdAt: { gte: since } } }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
    }),
  ]);

  const metrics = [
    ["Total users", totalUsers],
    [`New users · ${days}d`, newUsers],
    [`Active users · ${days}d`, activeUsers],
    ["Active listings", activeListings],
    ["Published guides", publishedGuides],
    ["Published city hubs", publishedCities],
    [`Reports · ${days}d`, reportVolume],
  ] as const;
  const maximum = Math.max(1, ...eventGroups.map((event) => event._count._all));

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Real database metrics only. No estimated traffic or fabricated conversion data."
        eyebrow="Kondo operations"
        title="Analytics"
      />
      <AdminNav currentPath="/admin/analytics" role={user.role} />
      <div className="mt-7 flex flex-wrap gap-2">
        {ranges.map((range) => (
          <Button
            asChild
            key={range}
            variant={days === range ? "primary" : "secondary"}
          >
            <Link href={`/admin/analytics?days=${range}`}>{range} days</Link>
          </Button>
        ))}
      </div>
      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 text-3xl font-black text-kondo-ink dark:text-white">
              {value.toLocaleString()}
            </p>
          </Card>
        ))}
      </section>
      <Card className="mt-6">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-kondo-green" />
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Recorded product events
            </h2>
            <p className="text-xs text-muted-foreground">
              Event counts from AnalyticsEvent during the selected period.
            </p>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          {eventGroups.map((event) => (
            <div key={event.name}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-muted-foreground">
                  {event.name.replaceAll("_", " ")}
                </span>
                <span className="text-muted-foreground">
                  {event._count._all}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-white/10">
                <div
                  className="h-2 rounded-full bg-kondo-green"
                  style={{
                    width: `${Math.max(2, (event._count._all / maximum) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
          {!eventGroups.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No analytics events were recorded in this period.
            </p>
          ) : null}
        </div>
      </Card>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/admin/users" icon={Users} label="Review users" />
        <QuickLink href="/admin/reports" icon={Flag} label="Review reports" />
        <QuickLink href="/admin/audit" icon={Search} label="Open audit log" />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Users;
  label: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex items-center gap-3 transition hover:border-kondo-green/50">
        <Icon className="h-5 w-5 text-kondo-green" />
        <span className="font-bold text-kondo-ink dark:text-white">
          {label}
        </span>
      </Card>
    </Link>
  );
}
