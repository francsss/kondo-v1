import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BookOpenText,
  Flag,
  ShieldCheck,
  ShoppingBag,
  Users,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { formatRelativeDate } from "@/lib/presentation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireAdmin();
  if (!hasAdminPermission(user.role, "ADMIN_VIEW_PLATFORM_OVERVIEW")) {
    redirect("/admin/reports");
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 7);
  const [
    totalUsers,
    newUsers,
    communityCount,
    activeListings,
    publishedGuides,
    publishedCityHubs,
    pendingCityHubs,
    pendingCommunities,
    pendingListings,
    upcomingEvents,
    openReports,
    recentUsers,
    reports,
    events,
    recentAudit,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.community.count(),
    prisma.marketplaceListing.count({
      where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
    }),
    prisma.guide.count({ where: { published: true } }),
    prisma.cityHub.count({ where: { status: "PUBLISHED" } }),
    prisma.cityHub.count({ where: { status: "REVIEW" } }),
    prisma.community.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.marketplaceListing.count({
      where: { status: "DRAFT", fraudScore: { gte: 70 } },
    }),
    prisma.post.count({
      where: {
        type: "EVENT",
        status: "PUBLISHED",
        eventValidatedAt: { not: null },
        eventAt: { gte: new Date() },
      },
    }),
    prisma.report.count({ where: { status: { in: ["OPEN", "REVIEWING"] } } }),
    prisma.user.findMany({
      include: { country: true, university: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.report.findMany({
      include: { reporter: true, assignee: true },
      where: { status: { in: ["OPEN", "REVIEWING"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.analyticsEvent.groupBy({
      by: ["name"],
      where: { createdAt: { gte: since } },
      _count: true,
    }),
    prisma.auditLog.findMany({
      select: {
        id: true,
        action: true,
        entityType: true,
        createdAt: true,
        actor: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const stats = [
    {
      label: "Total users",
      value: totalUsers,
      icon: Users,
      accent:
        "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
    },
    {
      label: "New users · 7d",
      value: newUsers,
      icon: Users,
      accent:
        "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",
    },
    {
      label: "Communities",
      value: communityCount,
      icon: ShieldCheck,
      accent: "bg-sky-100 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300",
    },
    {
      label: "Active listings",
      value: activeListings,
      icon: ShoppingBag,
      accent:
        "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
    },
    {
      label: "Published guides",
      value: publishedGuides,
      icon: BookOpenText,
      accent:
        "bg-lime-100 text-lime-700 dark:bg-lime-400/10 dark:text-lime-300",
    },
    {
      label: "Published city hubs",
      value: publishedCityHubs,
      icon: BookOpenText,
      accent:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300",
    },
    {
      label: "Open reports",
      value: openReports,
      icon: Flag,
      accent:
        "bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300",
    },
    {
      label: "Pending review",
      value: pendingCityHubs + pendingCommunities + pendingListings,
      icon: Flag,
      accent:
        "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
    },
    {
      label: "Upcoming events",
      value: upcomingEvents,
      icon: ShieldCheck,
      accent:
        "bg-pink-100 text-pink-700 dark:bg-pink-400/10 dark:text-pink-300",
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="A calm operational view of community health, safety, content, and weekly engagement."
        eyebrow="Kondo operations"
        title="Admin overview"
      />
      <AdminNav currentPath="/admin" role={user.role} />
      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, accent }) => (
          <Card key={label}>
            <div className="flex items-center justify-between">
              <span
                className={`grid h-10 w-10 place-items-center rounded-2xl ${accent}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-bold text-slate-400">Live</span>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight text-kondo-ink dark:text-white">
              {value.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-slate-400">{label}</p>
          </Card>
        ))}
      </section>
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-black text-kondo-ink dark:text-white">
                Weekly engagement
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Events across the last seven days
              </p>
            </div>
            <span className="rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
              WAU focus
            </span>
          </div>
          <div className="mt-7 flex h-56 items-end gap-3">
            {events.length ? (
              events.map((event) => {
                const max = Math.max(...events.map((item) => item._count));
                return (
                  <div
                    className="group flex flex-1 flex-col items-center gap-2"
                    key={event.name}
                  >
                    <span className="text-[10px] font-bold text-slate-400 opacity-0 transition group-hover:opacity-100">
                      {event._count}
                    </span>
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-kondo-forest to-kondo-green transition hover:brightness-110"
                      style={{
                        height: `${Math.max(16, (event._count / max) * 170)}px`,
                      }}
                    />
                    <span className="max-w-full truncate text-[9px] font-semibold text-slate-400">
                      {event.name.split("_")[0]}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="m-auto text-center text-sm text-slate-400">
                Analytics will populate as students use Kondo.
              </div>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-black text-kondo-ink dark:text-white">
              Moderation queue
            </h2>
            <Button asChild size="sm" variant="ghost">
              <Link href="/admin/reports">View all</Link>
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {reports.length ? (
              reports.map((report) => (
                <div
                  className="rounded-2xl bg-slate-50 p-3.5 dark:bg-white/5"
                  key={report.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                      {report.status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatRelativeDate(report.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-kondo-ink dark:text-white">
                    {report.reason} · {report.targetType}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Reported by{" "}
                    {report.reporter
                      ? `${report.reporter.firstName} ${report.reporter.lastName}`
                      : "a deleted member"}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                No open reports. Nice and quiet.
              </p>
            )}
          </div>
        </Card>
      </div>
      <Card className="mt-7 overflow-hidden p-0">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              New students
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Recent account activity
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/users">
              Manage users <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-400 dark:border-white/10 dark:bg-white/[0.03]">
              <tr>
                <th className="px-5 py-3 font-semibold">Student</th>
                <th className="px-5 py-3 font-semibold">University</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Joined</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {recentUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar
                        className="h-8 w-8"
                        firstName={user.firstName}
                        lastName={user.lastName}
                      />
                      <div>
                        <p className="font-bold text-kondo-ink dark:text-white">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">
                    {user.country?.emoji}{" "}
                    {user.university?.shortName ?? "Onboarding"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-500 dark:bg-white/5 dark:text-slate-300">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {formatRelativeDate(user.createdAt)}
                  </td>
                  <td className="px-5 py-3">
                    <Button asChild size="icon" variant="ghost">
                      <Link
                        aria-label={`Review ${user.firstName}`}
                        href={`/admin/users/${user.id}`}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Recent administrative activity
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Latest persisted audit events
            </p>
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/audit">Full audit log</Link>
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {recentAudit.map((entry) => (
            <div
              className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"
              key={entry.id}
            >
              <p className="text-sm font-bold text-kondo-ink dark:text-white">
                {entry.action.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {entry.entityType} ·{" "}
                {entry.actor
                  ? `${entry.actor.firstName} ${entry.actor.lastName}`
                  : "System"}{" "}
                · {formatRelativeDate(entry.createdAt)}
              </p>
            </div>
          ))}
          {!recentAudit.length ? (
            <p className="text-sm text-slate-400">No audit events yet.</p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
