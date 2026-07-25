import type { PetFeedbackCategory, PetFeedbackStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  MessageSquareHeart,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPetFeedbackSummary, listPetFeedback } from "@/lib/pet-feedback";
import {
  petFeedbackCategories,
  petFeedbackPageAreas,
  petFeedbackStatuses,
} from "@/lib/pet-feedback-validation";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "MVP feedback" };

const areaLabels: Record<string, string> = {
  home: "Home",
  communities: "Communities",
  explore: "Explore",
  marketplace: "Marketplace",
  student_hub: "Student Hub",
};

const statusStyles: Record<PetFeedbackStatus, string> = {
  NEW: "bg-amber-100 text-amber-800 dark:bg-amber-400/10 dark:text-amber-200",
  IN_PROGRESS: "bg-sky-100 text-sky-800 dark:bg-sky-400/10 dark:text-sky-200",
  RESOLVED:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200",
};

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function queryHref(
  params: Record<string, string | string[] | undefined>,
  pathname: string,
  page?: number,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const item = stringParam(value);
    if (item && key !== "page") query.set(key, item);
  }
  if (page) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("FEEDBACK_VIEW");
  const params = await searchParams;
  const statusParam = stringParam(params.status) ?? "";
  const categoryParam = stringParam(params.category) ?? "";
  const areaParam = stringParam(params.area) ?? "";
  const [result, summary] = await Promise.all([
    listPetFeedback(user, {
      page: Number(stringParam(params.page) ?? 1),
      query: stringParam(params.q)?.trim() || undefined,
      status: petFeedbackStatuses.includes(
        statusParam as (typeof petFeedbackStatuses)[number],
      )
        ? (statusParam as PetFeedbackStatus)
        : undefined,
      category: petFeedbackCategories.includes(
        categoryParam as (typeof petFeedbackCategories)[number],
      )
        ? (categoryParam as PetFeedbackCategory)
        : undefined,
      pageArea: petFeedbackPageAreas.includes(
        areaParam as (typeof petFeedbackPageAreas)[number],
      )
        ? areaParam
        : undefined,
    }),
    getPetFeedbackSummary(user),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review the structured feedback collected by the temporary Kondo Pet during the MVP."
        eyebrow="Kondo operations"
        title="MVP feedback"
      />
      <AdminNav currentPath="/admin/feedback" role={user.role} />

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "New",
            value: summary.counts.NEW ?? 0,
            tone: "text-amber-700 dark:text-amber-300",
          },
          {
            label: "In progress",
            value: summary.counts.IN_PROGRESS ?? 0,
            tone: "text-sky-700 dark:text-sky-300",
          },
          {
            label: "Resolved",
            value: summary.counts.RESOLVED ?? 0,
            tone: "text-emerald-700 dark:text-emerald-300",
          },
          {
            label: "Average completion",
            value: summary.averageSubmissionMs
              ? `${Math.max(1, Math.round(summary.averageSubmissionMs / 1000))}s`
              : "—",
            tone: "text-kondo-green",
          },
        ].map((item) => (
          <Card key={item.label}>
            <p className={`text-3xl font-black tracking-tight ${item.tone}`}>
              {item.value}
            </p>
            <p className="mt-1 text-xs font-bold text-muted-foreground">
              {item.label}
            </p>
          </Card>
        ))}
      </section>

      <Card className="mt-6">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input
            aria-label="Search feedback"
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm outline-none focus:border-kondo-green xl:col-span-2"
            defaultValue={stringParam(params.q)}
            name="q"
            placeholder="Search feedback, member, page, or ID"
          />
          <select
            aria-label="Filter by status"
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={statusParam}
            name="status"
          >
            <option value="">All statuses</option>
            {petFeedbackStatuses.map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={categoryParam}
            name="category"
          >
            <option value="">All categories</option>
            {petFeedbackCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by product area"
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={areaParam}
            name="area"
          >
            <option value="">All product areas</option>
            {petFeedbackPageAreas.map((area) => (
              <option key={area} value={area}>
                {areaLabels[area]}
              </option>
            ))}
          </select>
          <Button type="submit">Apply filters</Button>
        </form>
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button asChild size="sm" variant="secondary">
            <Link
              href={queryHref(params, "/api/admin/feedback/export", undefined)}
            >
              <Download className="h-4 w-4" /> Export current results
            </Link>
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-3">
        {result.feedback.length ? (
          result.feedback.map((feedback) => (
            <Link
              className="block rounded-3xl border border-border bg-card p-5 text-card-foreground transition hover:-translate-y-0.5 hover:border-kondo-green/60 hover:shadow-soft"
              href={`/admin/feedback/${feedback.id}`}
              key={feedback.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-kondo-green dark:bg-emerald-400/10">
                  <MessageSquareHeart className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${statusStyles[feedback.status]}`}
                    >
                      {feedback.status.replace("_", " ")}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black text-muted-foreground">
                      {feedback.category}
                    </span>
                    <span className="text-xs font-bold text-kondo-green">
                      {areaLabels[feedback.pageArea] ?? feedback.pageArea}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-kondo-ink dark:text-white">
                    {feedback.message}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {feedback.user
                      ? `${feedback.user.firstName} ${feedback.user.lastName}`
                      : "Deleted member"}{" "}
                    · {feedback.pagePath} · {feedback._count.notes} internal{" "}
                    {feedback._count.notes === 1 ? "note" : "notes"}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
                  <p className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {formatRelativeDate(feedback.createdAt)}
                  </p>
                  {feedback.submittedAfterMs !== null ? (
                    <p className="mt-1">
                      Submitted in{" "}
                      {Math.max(
                        1,
                        Math.round(feedback.submittedAfterMs / 1000),
                      )}
                      s
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <Card className="py-16 text-center">
            <MessageSquareHeart className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-4 font-black text-kondo-ink dark:text-white">
              No feedback matches these filters.
            </p>
          </Card>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} feedback
          items
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link
                href={queryHref(params, "/admin/feedback", result.page - 1)}
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
                href={queryHref(params, "/admin/feedback", result.page + 1)}
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
