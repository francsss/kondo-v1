import Link from "next/link";
import {
  BellRing,
  BarChart3,
  BookOpenText,
  Building2,
  Database,
  FileSearch,
  Files,
  Images,
  LayoutDashboard,
  MapPin,
  MessageCircleWarning,
  ShoppingBag,
  ScrollText,
  Settings2,
  Users,
} from "lucide-react";
import { hasAdminPermission, type AppRole } from "@/lib/authorization";

const items = [
  {
    href: "/admin",
    label: "Overview",
    icon: LayoutDashboard,
    permission: "ADMIN_VIEW_PLATFORM_OVERVIEW" as const,
  },
  {
    href: "/admin/communities",
    label: "Communities",
    icon: Building2,
    permission: "COMMUNITY_CMS_VIEW" as const,
  },
  {
    href: "/admin/marketplace",
    label: "Marketplace",
    icon: ShoppingBag,
    permission: "MARKETPLACE_CMS_VIEW" as const,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: FileSearch,
    permission: "REPORT_LIST" as const,
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    icon: ScrollText,
    permission: "AUDIT_VIEW_GLOBAL" as const,
  },
  {
    href: "/admin/reference-data",
    label: "Reference data",
    icon: Database,
    permission: "REFERENCE_DATA_VIEW" as const,
  },
  {
    href: "/admin/media",
    label: "Media",
    icon: Images,
    permission: "MEDIA_VIEW" as const,
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: BellRing,
    permission: "NOTIFICATION_VIEW" as const,
  },
  {
    href: "/admin/message-safety",
    label: "Message safety",
    icon: MessageCircleWarning,
    permission: "MESSAGE_SAFETY_VIEW" as const,
  },
  {
    href: "/admin/users",
    label: "Users",
    icon: Users,
    permission: "USER_VIEW" as const,
  },
  {
    href: "/admin/guides",
    label: "Guides",
    icon: BookOpenText,
    permission: "GUIDE_CMS_VIEW" as const,
  },
  {
    href: "/admin/content",
    label: "Content",
    icon: Files,
    permission: "GUIDE_CMS_VIEW" as const,
  },
  {
    href: "/admin/city-hubs",
    label: "City hubs",
    icon: MapPin,
    permission: "CITY_CMS_VIEW" as const,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: BarChart3,
    permission: "ANALYTICS_VIEW" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings2,
    permission: "PLATFORM_SETTINGS_VIEW" as const,
  },
];

export function AdminNav({
  role,
  currentPath,
}: {
  role: AppRole | string;
  currentPath: string;
}) {
  return (
    <nav
      aria-label="Admin navigation"
      className="scrollbar-none mt-7 flex gap-2 overflow-x-auto pb-1"
    >
      {items
        .filter((item) => hasAdminPermission(role, item.permission))
        .map(({ href, label, icon: Icon }) => {
          const active =
            currentPath === href ||
            (href !== "/admin" && currentPath.startsWith(`${href}/`));
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-kondo-ink px-4 py-2 text-sm font-bold text-white dark:bg-emerald-400 dark:text-kondo-ink"
                  : "inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-500 transition hover:border-kondo-green hover:text-kondo-green dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              }
              href={href}
              key={href}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}
