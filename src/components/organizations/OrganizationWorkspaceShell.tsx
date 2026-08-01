"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BadgeCheck,
  Building2,
  ClipboardList,
  Globe2,
  House,
  LayoutDashboard,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  activeWorkspaceNavigationKey,
  type WorkspaceNavigationIconKey,
  type WorkspaceNavigationItem,
} from "@/lib/organization-workspace-navigation";
import { cn } from "@/lib/utils";

const NAVIGATION_ICONS: Record<WorkspaceNavigationIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  profile: Building2,
  "public-profile": Globe2,
  housing: House,
  opportunities: Target,
  applications: ClipboardList,
  catalog: Package,
  products: Package,
  services: Sparkles,
  inquiries: MessageCircle,
  team: Users,
  verification: ShieldCheck,
  activity: Activity,
  settings: Settings,
};

export type WorkspaceHeroAction = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type WorkspaceShellOrganization = {
  slug: string;
  publicName: string;
  type: string;
  logoMediaId: string | null;
  coverMediaId?: string | null;
  lifecycleStatus: string;
  publicProfileStatus: string;
  verificationStatus: string;
  suspensionReason: string | null;
  isOfficialPartner?: boolean;
  city?: { name: string } | null;
  country?: { name: string; emoji?: string | null } | null;
};

function humanize(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export function OrganizationWorkspaceShell({
  children,
  organization,
  role,
  navigation,
  actions = [],
}: {
  children: React.ReactNode;
  organization: WorkspaceShellOrganization;
  role: string;
  navigation: WorkspaceNavigationItem[];
  actions?: WorkspaceHeroAction[];
}) {
  const pathname = usePathname();
  const activeKey = activeWorkspaceNavigationKey(navigation, pathname);
  const activeItem = navigation.find((item) => item.key === activeKey) ?? null;
  // Deep routes (create, edit, one application) keep the organization context
  // without spending a full viewport on a hero the member has already seen.
  const compact = Boolean(activeItem && pathname !== activeItem.href);
  const suspended = organization.lifecycleStatus === "SUSPENDED";
  const location = [organization.city?.name, organization.country?.name]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      {compact ? (
        <CompactHeader
          activeItem={activeItem}
          organization={organization}
          role={role}
        />
      ) : (
        <WorkspaceHero
          actions={actions}
          location={location}
          organization={organization}
          role={role}
        />
      )}

      {suspended ? (
        <div
          className="mt-4 rounded-3xl border border-warning/30 bg-warning/10 px-5 py-4 text-sm font-semibold text-warning-foreground"
          role="status"
        >
          This workspace is suspended and cannot publish.{" "}
          {organization.suspensionReason ||
            "Contact Kondo support for more information."}
        </div>
      ) : null}

      <nav
        aria-label="Organization workspace"
        className="subnav-row mt-4 gap-1 rounded-3xl border border-border bg-card p-1.5 shadow-soft"
      >
        {navigation.map((item) => {
          const Icon = NAVIGATION_ICONS[item.icon];
          const active = item.key === activeKey;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition",
                active
                  ? "bg-secondary text-secondary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={item.href}
              key={item.key}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {item.label}
              {item.state === "setup" ? (
                <Lock
                  aria-label="Setup required"
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <main className="py-6">{children}</main>
    </div>
  );
}

function WorkspaceHero({
  actions,
  location,
  organization,
  role,
}: {
  actions: WorkspaceHeroAction[];
  location: string;
  organization: WorkspaceShellOrganization;
  role: string;
}) {
  return (
    <header className="overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
      <div className="relative h-28 sm:h-40">
        {organization.coverMediaId ? (
          <MediaImage
            alt=""
            className="h-full w-full object-cover"
            height={420}
            mediaId={organization.coverMediaId}
            sizes="(max-width: 1024px) 100vw, 1200px"
            width={1680}
          />
        ) : (
          // Never a stock company photo: a restrained brand gradient instead.
          <div
            aria-hidden="true"
            className="h-full w-full bg-gradient-to-br from-kondo-forest via-kondo-green to-emerald-500 dark:from-kondo-navy dark:via-kondo-forest dark:to-emerald-700"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent"
        />
      </div>

      <div className="relative -mt-12 px-5 pb-6 sm:-mt-14 sm:px-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end">
          <Avatar
            className="h-20 w-20 rounded-3xl border-4 border-card text-xl shadow-lift sm:h-24 sm:w-24"
            firstName={organization.publicName}
            lastName=""
            mediaId={organization.logoMediaId}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-kondo-green">
              Organization workspace
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              {organization.publicName}
            </h1>
            <p className="mt-1.5 text-sm capitalize text-muted-foreground">
              {humanize(organization.type)}
              {location ? (
                <>
                  {" · "}
                  <MapPin
                    aria-hidden="true"
                    className="inline h-3.5 w-3.5 align-[-2px]"
                  />{" "}
                  {location}
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill status={organization.verificationStatus} />
              <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-black capitalize text-muted-foreground">
                Public profile {humanize(organization.publicProfileStatus)}
              </span>
              <span className="inline-flex rounded-full bg-secondary px-3 py-1.5 text-xs font-black capitalize text-secondary-foreground">
                Your role: {role.toLowerCase()}
              </span>
              {organization.isOfficialPartner ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-kondo-mint px-3 py-1.5 text-xs font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200">
                  <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                  Official partner
                </span>
              ) : null}
            </div>
          </div>

          {actions.length ? (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {actions.map((action) => (
                <Button
                  asChild
                  key={action.href + action.label}
                  variant={
                    action.variant === "primary" ? "primary" : "secondary"
                  }
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function CompactHeader({
  activeItem,
  organization,
  role,
}: {
  activeItem: WorkspaceNavigationItem | null;
  organization: WorkspaceShellOrganization;
  role: string;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-card px-4 py-3 shadow-soft sm:px-5">
      {activeItem ? (
        <Link
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          href={activeItem.href}
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {activeItem.label}
        </Link>
      ) : null}
      <span aria-hidden="true" className="h-5 w-px bg-border" />
      <Avatar
        className="h-9 w-9 rounded-xl text-xs"
        firstName={organization.publicName}
        lastName=""
        mediaId={organization.logoMediaId}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{organization.publicName}</p>
        <p className="text-[11px] font-semibold text-muted-foreground">
          Organization workspace · {role.toLowerCase()}
        </p>
      </div>
    </header>
  );
}

function StatusPill({ status }: { status: string }) {
  const verified = status === "VERIFIED";
  const pending = status === "PENDING";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black capitalize",
        verified
          ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          : pending
            ? "bg-warning/15 text-warning-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      {verified ? (
        <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5" />
      ) : null}
      {verified
        ? "Verified organization"
        : pending
          ? "Verification pending"
          : humanize(status)}
    </span>
  );
}
