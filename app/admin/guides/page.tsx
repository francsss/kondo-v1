import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { GuideCreateForm } from "@/components/features/admin/GuideCreateForm";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listAdminGuides } from "@/lib/guides";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin Guides" };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(input: { q?: string; published?: string }, page: number) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.published) params.set("published", input.published);
  if (page > 1) params.set("page", String(page));
  return `/admin/guides?${params.toString()}`;
}

export default async function AdminGuidesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("GUIDE_CMS_VIEW");
  const params = await searchParams;
  const query = one(params.q)?.trim() || undefined;
  const publishedParam = one(params.published);
  const published =
    publishedParam === "true"
      ? true
      : publishedParam === "false"
        ? false
        : undefined;
  const result = await listAdminGuides(user, {
    page: Number(one(params.page) ?? 1),
    query,
    published,
  });
  const linkInput = { q: query, published: publishedParam };

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Create, edit, and publish the Arrival Guide library shown in Student Hub."
        eyebrow="Kondo operations"
        title="Guides"
      />
      <AdminNav currentPath="/admin/guides" role={user.role} />
      <Card className="mt-7">
        <form className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_200px_auto]">
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder="Title or slug"
          />
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-transparent px-3 text-sm dark:border-white/10"
            defaultValue={publishedParam ?? ""}
            name="published"
          >
            <option value="">All guides</option>
            <option value="true">Published</option>
            <option value="false">Draft</option>
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>
      <div className="mt-6 space-y-3">
        {result.records.map((guide) => (
          <Link href={`/admin/guides/${guide.id}`} key={guide.id}>
            <Card className="mb-3 grid gap-4 transition hover:border-kondo-green/40 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-black text-kondo-ink dark:text-white">
                    {guide.title}
                  </h2>
                  <span
                    className={
                      guide.published
                        ? "rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                        : "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300"
                    }
                  >
                    {guide.published ? "PUBLISHED" : "DRAFT"}
                  </span>
                  {guide.featured ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                      FEATURED
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {guide.category.replaceAll("_", " ")} · {guide._count.steps}{" "}
                  step
                  {guide._count.steps === 1 ? "" : "s"}
                </p>
              </div>
              <p className="text-xs text-slate-400">
                {guide.estimatedMinutes} min
              </p>
              <p className="text-xs text-slate-400">
                Updated {new Date(guide.updatedAt).toLocaleDateString()}
              </p>
            </Card>
          </Link>
        ))}
        {!result.records.length ? (
          <Card className="py-16 text-center text-sm text-slate-400">
            No guides match these filters.
          </Card>
        ) : null}
      </div>
      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {result.page} of {result.pageCount} · {result.total}
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={href(linkInput, Math.max(1, result.page - 1))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link
              href={href(
                linkInput,
                Math.min(result.pageCount, result.page + 1),
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <GuideCreateForm />
    </div>
  );
}
