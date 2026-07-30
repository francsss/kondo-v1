"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

const workspaceNavigation = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["profile", "Profile", Building2],
  ["team", "Team", Users],
  ["verification", "Verification", ShieldCheck],
  ["activity", "Activity", Activity],
  ["settings", "Settings", Settings],
] as const;

export function OrganizationWorkspaceShell({
  children,
  organization,
  role,
}: {
  children: React.ReactNode;
  organization: {
    slug: string;
    publicName: string;
    type: string;
    logoMediaId: string | null;
    lifecycleStatus: string;
    verificationStatus: string;
    suspensionReason: string | null;
  };
  role: string;
}) {
  const pathname = usePathname();
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="overflow-hidden rounded-4xl border border-border bg-card shadow-soft">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
          <Avatar
            className="h-16 w-16 rounded-2xl text-lg"
            firstName={organization.publicName}
            lastName=""
            mediaId={organization.logoMediaId}
          />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-kondo-green">
              Organization workspace
            </p>
            <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">
              {organization.publicName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {organization.type.replaceAll("_", " ").toLowerCase()} ·{" "}
              {role.toLowerCase()} ·{" "}
              {organization.lifecycleStatus.toLowerCase()}
            </p>
          </div>
          <div className="sm:ml-auto">
            <StatusBadge status={organization.verificationStatus} />
          </div>
        </div>
        {organization.lifecycleStatus === "SUSPENDED" ? (
          <div
            className="border-t border-warning/30 bg-warning/10 px-5 py-4 text-sm font-semibold text-warning-foreground sm:px-7"
            role="status"
          >
            This workspace is suspended.{" "}
            {organization.suspensionReason ||
              "Contact Kondo support for more information."}
          </div>
        ) : null}
        <nav
          aria-label="Organization workspace"
          className="flex gap-1 overflow-x-auto border-t border-border px-3 py-2 [scrollbar-width:none] sm:px-5"
        >
          {workspaceNavigation.map(([segment, label, Icon]) =>
            (() => {
              const href = `/organizations/${organization.slug}/${segment}`;
              const active = pathname === href;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  href={href}
                  key={segment}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                </Link>
              );
            })(),
          )}
        </nav>
      </header>
      <main className="py-6">{children}</main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const verified = status === "VERIFIED";
  const pending = status === "PENDING";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1.5 text-xs font-black",
        verified
          ? "bg-kondo-mint text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-200"
          : pending
            ? "bg-warning/15 text-warning-foreground"
            : "bg-muted text-muted-foreground",
      )}
    >
      {verified
        ? "Verified organization"
        : pending
          ? "Verification pending"
          : status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}
