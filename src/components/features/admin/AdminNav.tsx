import Link from "next/link";
import {
  BellRing,
  BarChart3,
  BadgeCheck,
  BookOpenText,
  BriefcaseBusiness,
  Building2,
  Clapperboard,
  Database,
  FileSearch,
  Files,
  GraduationCap,
  House,
  Images,
  LayoutDashboard,
  RadioTower,
  MapPin,
  Landmark,
  MessageCircleWarning,
  MessageSquareHeart,
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
    href: "/admin/catalog",
    label: "Products & services",
    icon: ShoppingBag,
    permission: "ORGANIZATION_CATALOG_VIEW" as const,
  },
  {
    href: "/admin/housing",
    label: "Housing",
    icon: House,
    permission: "HOUSING_VIEW" as const,
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: FileSearch,
    permission: "REPORT_LIST" as const,
  },
  {
    href: "/admin/feedback",
    label: "MVP feedback",
    icon: MessageSquareHeart,
    permission: "FEEDBACK_VIEW" as const,
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
    href: "/admin/student-hub",
    label: "Student hub",
    icon: GraduationCap,
    permission: "STUDENT_HUB_CONFIG_VIEW" as const,
  },
  {
    href: "/admin/scholarships",
    label: "Scholarships",
    icon: GraduationCap,
    permission: "STUDENT_HUB_CONFIG_VIEW" as const,
  },
  {
    href: "/admin/opportunities",
    label: "Opportunities",
    icon: BriefcaseBusiness,
    permission: "OPPORTUNITIES_VIEW" as const,
  },
  {
    href: "/admin/opportunity-applications",
    label: "Opportunity applications",
    icon: Files,
    permission: "OPPORTUNITY_APPLICATIONS_VIEW" as const,
  },
  {
    href: "/admin/opportunity-reports",
    label: "Opportunity reports",
    icon: FileSearch,
    permission: "OPPORTUNITY_REPORTS_REVIEW" as const,
  },
  {
    href: "/admin/scholarship-agents",
    label: "Scholarship agents",
    icon: GraduationCap,
    permission: "SCHOLARSHIP_AGENTS_VIEW" as const,
  },
  {
    href: "/admin/live",
    label: "Live users",
    icon: RadioTower,
    permission: "ANALYTICS_VIEW" as const,
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
  {
    href: "/admin/stories",
    label: "Student Stories",
    icon: Clapperboard,
    permission: "STORY_CMS_VIEW" as const,
  },
  {
    href: "/admin/official-profiles",
    label: "Official profiles",
    icon: Landmark,
    permission: "OFFICIAL_PROFILE_VIEW" as const,
  },
  {
    href: "/admin/organizations",
    label: "Organizations",
    icon: Building2,
    permission: "ORGANIZATIONS_VIEW" as const,
  },
  {
    href: "/admin/organization-verifications",
    label: "Organization verification",
    icon: BadgeCheck,
    permission: "ORGANIZATION_VERIFICATIONS_VIEW" as const,
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
    <nav aria-label="Admin navigation" className="subnav-row mt-7 gap-2 pb-1">
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
                  ? "inline-flex items-center justify-center gap-2 rounded-full bg-kondo-ink px-3 py-2 text-xs font-bold text-white transition duration-200 dark:bg-emerald-400 dark:text-kondo-ink sm:px-4 sm:text-sm"
                  : "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-muted-foreground transition duration-200 hover:-translate-y-0.5 hover:border-kondo-green hover:text-kondo-green dark:border-white/10 dark:bg-white/5 dark:text-muted-foreground sm:px-4 sm:text-sm"
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
