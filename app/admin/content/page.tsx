import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, Building2, CalendarDays, MapPin } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin content" };

export default async function AdminContentPage() {
  const user = await requireAdminPermission("GUIDE_CMS_VIEW");
  const now = new Date();
  const [guides, cityHubs, officialCommunities, upcomingEvents] =
    await Promise.all([
      prisma.guide.count(),
      prisma.cityHub.count(),
      prisma.community.count({ where: { isOfficial: true } }),
      prisma.post.count({
        where: {
          type: "EVENT",
          status: "PUBLISHED",
          eventValidatedAt: { not: null },
          eventAt: { gte: now },
        },
      }),
    ]);

  const modules = [
    {
      href: "/admin/guides",
      label: "Student Hub guides",
      description:
        "Create guides, ordered steps, drafts, and published Student Hub content.",
      value: guides,
      icon: BookOpenText,
    },
    {
      href: "/admin/city-hubs",
      label: "City Hub",
      description:
        "Manage scalable city pages, modules, local entries, review, and publication.",
      value: cityHubs,
      icon: MapPin,
    },
    {
      href: "/admin/communities",
      label: "Official communities",
      description:
        "Maintain official community metadata and moderate user-created spaces.",
      value: officialCommunities,
      icon: Building2,
    },
    {
      href: "/admin/communities",
      label: "Community events",
      description:
        "Upcoming validated events use the existing community event lifecycle.",
      value: upcomingEvents,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Editorial entry point for database-backed public content. Legal pages and secrets remain code- or environment-controlled."
        eyebrow="Kondo operations"
        title="Content"
      />
      <AdminNav currentPath="/admin/content" role={user.role} />
      <section className="mt-7 grid gap-5 md:grid-cols-2">
        {modules.map(({ href, label, description, value, icon: Icon }) => (
          <Link href={href} key={label}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-kondo-green/50">
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-2xl font-black text-kondo-ink dark:text-white">
                  {value}
                </span>
              </div>
              <h2 className="mt-5 font-black text-kondo-ink dark:text-white">
                {label}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
