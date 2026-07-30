"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronDown, Plus, UserRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export type WorkspaceSwitcherItem = {
  id: string;
  slug: string;
  publicName: string;
  type: string;
  logoMediaId: string | null;
  lifecycleStatus: string;
  verificationStatus: string;
  role: "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";
};

export function WorkspaceSwitcher({
  user,
  workspaces,
}: {
  user: {
    firstName: string;
    lastName: string;
    avatarMediaId?: string | null;
  };
  workspaces: WorkspaceSwitcherItem[];
}) {
  const pathname = usePathname();
  const current = workspaces.find((workspace) =>
    pathname.startsWith(`/organizations/${workspace.slug}`),
  );
  const currentName = current?.publicName ?? "Personal";

  return (
    <details className="group relative shrink-0">
      <summary
        aria-label={`Current workspace: ${currentName}. Switch workspace`}
        className="flex h-11 max-w-[210px] cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-card px-2.5 pr-3 text-left shadow-sm transition hover:border-primary/40 [&::-webkit-details-marker]:hidden"
      >
        {current ? (
          <WorkspaceMark
            logoMediaId={current.logoMediaId}
            name={current.publicName}
          />
        ) : (
          <Avatar
            className="h-7 w-7 text-[10px]"
            firstName={user.firstName}
            lastName={user.lastName}
            mediaId={user.avatarMediaId}
          />
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs font-black">
            {currentName}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {current
              ? `${current.role.toLowerCase()} · ${current.lifecycleStatus.toLowerCase()}`
              : "Personal Kondo"}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="ml-auto h-3.5 w-3.5 text-muted-foreground transition group-open:rotate-180"
        />
      </summary>

      <div className="fixed inset-x-3 top-16 z-50 max-h-[min(70vh,560px)] overflow-y-auto rounded-3xl border border-border bg-card p-2 shadow-lift sm:absolute sm:inset-x-auto sm:right-0 sm:top-13 sm:w-80">
        <p className="px-3 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          Workspaces
        </p>
        <WorkspaceLink
          active={!current}
          href="/home"
          icon={<UserRound className="h-4 w-4" />}
          label={`${user.firstName} ${user.lastName}`}
          secondary="Personal Kondo"
        />
        {workspaces.map((workspace) => (
          <WorkspaceLink
            active={workspace.id === current?.id}
            href={`/organizations/${workspace.slug}/dashboard`}
            icon={
              <WorkspaceMark
                logoMediaId={workspace.logoMediaId}
                name={workspace.publicName}
              />
            }
            key={workspace.id}
            label={workspace.publicName}
            secondary={`${workspace.role.toLowerCase()} · ${
              workspace.verificationStatus === "VERIFIED"
                ? "verified"
                : workspace.lifecycleStatus.toLowerCase()
            }`}
          />
        ))}
        <div className="my-1 border-t border-border" />
        <WorkspaceLink
          href="/onboarding/organization?new=1"
          icon={<Plus className="h-4 w-4" />}
          label="Create an organization"
          secondary="Start a professional workspace"
        />
      </div>
    </details>
  );
}

function WorkspaceMark({
  logoMediaId,
  name,
}: {
  logoMediaId: string | null;
  name: string;
}) {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
      {logoMediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-full w-full object-cover"
          src={`/api/media/${logoMediaId}`}
        />
      ) : (
        <Building2 aria-hidden="true" className="h-4 w-4" />
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

function WorkspaceLink({
  active = false,
  href,
  icon,
  label,
  secondary,
}: {
  active?: boolean;
  href: string;
  icon: React.ReactNode;
  label: string;
  secondary: string;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 transition",
        active ? "bg-secondary" : "hover:bg-muted",
      )}
      href={href}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {secondary}
        </span>
      </span>
      {active ? (
        <Check
          aria-hidden="true"
          className="ml-auto h-4 w-4 text-kondo-green"
        />
      ) : null}
    </Link>
  );
}
