import type { CommunityStatus, CommunityType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAdminCommunities } from "@/lib/communities";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin communities" };

const STATUSES = ["PENDING_REVIEW", "ACTIVE", "ARCHIVED", "REMOVED"];
const TYPES = ["COUNTRY", "CITY", "UNIVERSITY", "TOPIC"];

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(
  input: { q?: string; status?: string; type?: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.status) params.set("status", input.status);
  if (input.type) params.set("type", input.type);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/communities?${query}` : "/admin/communities";
}

export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("COMMUNITY_CMS_VIEW");
  const params = await searchParams;
  const query = one(params.q)?.trim() || undefined;
  const rawStatus = one(params.status);
  const rawType = one(params.type);
  const status = STATUSES.includes(rawStatus ?? "")
    ? (rawStatus as CommunityStatus)
    : undefined;
  const type = TYPES.includes(rawType ?? "")
    ? (rawType as CommunityType)
    : undefined;
  const result = await listAdminCommunities(user, {
    page: Number(one(params.page) ?? 1),
    query,
    status,
    type,
  });
  const hrefInput = { q: query, status, type };

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review new communities, platform verification, ownership, access policy and operational activity."
        eyebrow="Kondo operations"
        title="Communities"
      />
      <AdminNav currentPath="/admin/communities" role={user.role} />
      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_210px_190px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="Name, slug or description"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={type ?? ""}
            name="type"
          >
            <option value="">All types</option>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>
      <div className="mt-6 space-y-3">
        {result.records.map((community) => (
          <Link href={`/admin/communities/${community.id}`} key={community.id}>
            <Card className="mb-3 grid gap-4 transition hover:-translate-y-0.5 hover:border-kondo-green/40 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black text-kondo-ink dark:text-white">
                    {community.name}
                  </h2>
                  {community.isVerified ? (
                    <span className="rounded-full bg-kondo-mint px-2 py-0.5 text-[10px] font-black text-kondo-forest">
                      VERIFIED
                    </span>
                  ) : null}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-white/10">
                    {community.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {community.type} · {community.joinPolicy} · Owner{" "}
                  {community.owner.fullName}
                </p>
              </div>
              <div className="text-xs text-slate-400">
                {community._count.members} members · {community._count.posts}{" "}
                posts · {community._count.accessRequests} pending
              </div>
              <p className="text-xs text-slate-400">
                {formatRelativeDate(new Date(community.updatedAt))}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      {!result.records.length ? (
        <Card className="mt-6 py-16 text-center text-sm text-slate-400">
          No communities match these filters.
        </Card>
      ) : null}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {result.page} of {result.pageCount} · {result.total} records
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={href(hrefInput, Math.max(1, result.page - 1))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link
              href={href(
                hrefInput,
                Math.min(result.pageCount, result.page + 1),
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
