import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAuditLogs } from "@/lib/moderation";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin audit log" };

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(
  params: Record<string, string | string[] | undefined>,
  page: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = stringParam(value);
    if (item && key !== "page") query.set(key, item);
  }
  query.set("page", String(page));
  return `/admin/audit?${query.toString()}`;
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("AUDIT_VIEW_GLOBAL");
  const params = await searchParams;
  const result = await listAuditLogs(user, {
    page: Number(stringParam(params.page) ?? 1),
    query: stringParam(params.q)?.trim() || undefined,
    action: stringParam(params.action)?.trim() || undefined,
    entityType: stringParam(params.entityType)?.trim() || undefined,
    actorId: stringParam(params.actorId)?.trim() || undefined,
  });

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Filter immutable operational events. Secret-bearing values are always redacted; security metadata is restricted to Super Admin."
        eyebrow="Kondo operations"
        title="Audit log"
      />
      <AdminNav currentPath="/admin/audit" role={user.role} />

      <Card className="mt-7">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10 dark:bg-white/5 xl:col-span-2"
            defaultValue={stringParam(params.q)}
            name="q"
            placeholder="Action, entity type, or entity ID"
          />
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
            defaultValue={stringParam(params.action)}
            name="action"
            placeholder="Action filter"
          />
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10 dark:bg-white/5"
            defaultValue={stringParam(params.entityType)}
            name="entityType"
            placeholder="Entity type"
          />
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {result.logs.length ? (
          result.logs.map((log) => (
            <Card key={log.id}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10">
                  <ScrollText className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-kondo-ink dark:text-white">
                      {log.action}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-white/5 dark:text-slate-300">
                      {log.entityType}
                    </span>
                  </div>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    {log.entityId} · {log.actor?.fullName ?? "System"} ·{" "}
                    {formatRelativeDate(log.createdAt)}
                  </p>
                  {log.newValue || log.oldValue ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-bold text-kondo-green">
                        View redacted change data
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/[0.03] dark:text-slate-400">
                        {JSON.stringify(
                          { oldValue: log.oldValue, newValue: log.newValue },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  ) : null}
                  {log.ipAddress || log.userAgent ? (
                    <p className="mt-3 text-[11px] text-slate-400">
                      Security metadata: {log.ipAddress ?? "unknown IP"} ·{" "}
                      {log.userAgent ?? "unknown agent"}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="py-16 text-center">
            <ScrollText className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-4 font-black text-kondo-ink dark:text-white">
              No audit events match these filters.
            </p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {result.page} of {result.pageCount} · {result.total} events
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={pageHref(params, result.page - 1)}>
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
              <Link href={pageHref(params, result.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
