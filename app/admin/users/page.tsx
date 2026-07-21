import type { Role, UserStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAdminUsers } from "@/lib/profiles";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin users" };
const statuses = ["ACTIVE", "SUSPENDED", "DEACTIVATED"] as const;
const roles = ["MEMBER", "MODERATOR", "ADMIN", "SUPER_ADMIN"] as const;

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(input: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `/admin/users?${params.toString()}`;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminPermission("USER_VIEW");
  const params = await searchParams;
  const query = stringParam(params.q)?.trim() || undefined;
  const rawStatus = stringParam(params.status);
  const status = statuses.includes(rawStatus as UserStatus)
    ? (rawStatus as UserStatus)
    : undefined;
  const rawRole = stringParam(params.role);
  const role = roles.includes(rawRole as Role) ? (rawRole as Role) : undefined;
  const result = await listAdminUsers(actor, {
    page: Number(stringParam(params.page) ?? 1),
    query,
    status,
    role,
  });

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review member identity, profile visibility, reports, account requests, and operational context without exposing credentials."
        eyebrow="Kondo operations"
        title="Users"
      />
      <AdminNav currentPath="/admin/users" role={actor.role} />
      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_190px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="Name, username, or email"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={role ?? ""}
            name="role"
          >
            <option value="">All roles</option>
            {roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {result.users.map((user) => (
          <Link
            className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 text-card-foreground transition hover:-translate-y-0.5 hover:border-primary sm:flex-row sm:items-center"
            href={`/admin/users/${user.id}`}
            key={user.id}
          >
            <Avatar
              firstName={user.firstName}
              lastName={user.lastName}
              mediaId={user.avatarMediaId}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-black text-kondo-ink dark:text-white">
                {user.fullName}
                {user.username ? ` · @${user.username}` : ""}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {user.email} · {user.university?.name ?? "No university"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10 dark:text-muted-foreground">
                {user.status}
              </span>
              <span className="rounded-full bg-kondo-mint px-2.5 py-1 text-[10px] font-black text-kondo-green dark:bg-emerald-400/10">
                {user.activeRequestCount} requests
              </span>
              <span className="text-xs text-muted-foreground">
                Joined {formatRelativeDate(new Date(user.createdAt))}
              </span>
            </div>
          </Link>
        ))}
        {!result.users.length ? (
          <Card className="py-16 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              No users match these filters.
            </p>
          </Card>
        ) : null}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} users
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link
                href={pageHref({ q: query, status, role }, result.page - 1)}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Link>
            </Button>
          )}
          {result.page >= result.pageCount ? (
            <Button disabled size="sm" variant="secondary">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link
                href={pageHref({ q: query, status, role }, result.page + 1)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
