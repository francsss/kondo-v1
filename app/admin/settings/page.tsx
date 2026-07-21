import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Database, Settings2, ShoppingBag } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin settings" };

export default async function AdminSettingsPage() {
  const user = await requireAdminPermission("PLATFORM_SETTINGS_VIEW");
  const [countries, cities, universities, marketplaceCategories, templates] =
    await Promise.all([
      prisma.country.count({ where: { isActive: true } }),
      prisma.city.count({ where: { isActive: true } }),
      prisma.university.count({ where: { isActive: true } }),
      prisma.marketplaceCategory.count({ where: { isActive: true } }),
      prisma.notificationTemplate.count({ where: { isActive: true } }),
    ]);

  const groups = [
    {
      href: "/admin/reference-data",
      label: "Supported locations",
      description: `${countries} countries, ${cities} cities, and ${universities} universities are active.`,
      icon: Database,
    },
    {
      href: "/admin/marketplace",
      label: "Marketplace categories",
      description: `${marketplaceCategories} categories are currently active.`,
      icon: ShoppingBag,
    },
    {
      href: "/admin/notifications",
      label: "Notification templates",
      description: `${templates} delivery templates are active.`,
      icon: BellRing,
    },
  ];

  return (
    <div className="mx-auto max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Safe public configuration only. Credentials, API keys, database URLs, and provider secrets are never exposed here."
        eyebrow="Kondo operations"
        title="Platform settings"
      />
      <AdminNav currentPath="/admin/settings" role={user.role} />
      <Card className="mt-7 border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-400/5">
        <div className="flex items-start gap-3">
          <Settings2 className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm leading-6 text-amber-800 dark:text-amber-200">
            Environment secrets remain managed in Vercel, Neon, Cloudflare,
            Resend, Upstash, and GitHub. This page intentionally contains no
            secret viewer or editor.
          </p>
        </div>
      </Card>
      <section className="mt-6 grid gap-4">
        {groups.map(({ href, label, description, icon: Icon }) => (
          <Link href={href} key={href}>
            <Card className="flex items-center gap-4 transition hover:border-kondo-green/50">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-kondo-ink dark:text-white">
                  {label}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {description}
                </p>
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
