import type { Metadata } from "next";
import type { ReportReason, ReportStatus } from "@prisma/client";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileSearch } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listReports } from "@/lib/moderation";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin reports" };

const statuses = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"] as const;
const reasons = [
  "SPAM",
  "HARASSMENT",
  "SCAM",
  "INAPPROPRIATE",
  "OTHER",
] as const;

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
  return `/admin/reports?${query.toString()}`;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("REPORT_LIST");
  const params = await searchParams;
  const status = stringParam(params.status);
  const reason = stringParam(params.reason);
  const result = await listReports(user, {
    page: Number(stringParam(params.page) ?? 1),
    status: statuses.includes(status as ReportStatus)
      ? (status as ReportStatus)
      : undefined,
    reason: reasons.includes(reason as ReportReason)
      ? (reason as ReportReason)
      : undefined,
    targetType: stringParam(params.targetType) || undefined,
    assignee: stringParam(params.assignee) || undefined,
    query: stringParam(params.q)?.trim() || undefined,
  });

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review, assign, decide, and preserve moderation cases without exposing private evidence outside authorized operations."
        eyebrow="Kondo operations"
        title="Reports"
      />
      <AdminNav currentPath="/admin/reports" role={user.role} />

      <Card className="mt-7">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10 dark:bg-white/5 xl:col-span-2"
            defaultValue={stringParam(params.q)}
            name="q"
            placeholder="Report ID, target, or details"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
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
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
            defaultValue={reason ?? ""}
            name="reason"
          >
            <option value="">All reasons</option>
            {reasons.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm dark:border-white/10 dark:bg-white/5"
            defaultValue={stringParam(params.assignee) ?? ""}
            name="assignee"
          >
            <option value="">All available cases</option>
            <option value="unassigned">Unassigned</option>
            <option value="me">Assigned to me</option>
          </select>
          <Button type="submit">Apply filters</Button>
        </form>
      </Card>

      <div className="mt-6 space-y-3">
        {result.reports.length ? (
          result.reports.map((report) => (
            <Link
              className="block rounded-3xl border border-border bg-card p-5 text-card-foreground transition hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
              href={`/admin/reports/${report.id}`}
              key={report.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-100 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                  <FileSearch className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/5 dark:text-muted-foreground">
                      {report.status}
                    </span>
                    <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                      {report.reason}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {report.targetType}
                    </span>
                  </div>
                  <p className="mt-2 truncate font-black text-kondo-ink dark:text-white">
                    Case {report.id}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Reporter: Protected · Assignee:{" "}
                    {report.assignee?.fullName ?? "Unassigned"} ·{" "}
                    {report.noteCount} notes · {report.evidenceCount} evidence
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Updated {formatRelativeDate(report.updatedAt)}</p>
                  <p className="mt-1">v{report.version}</p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <Card className="py-16 text-center">
            <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-black text-kondo-ink dark:text-white">
              No reports match these filters.
            </p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} reports
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
