import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Database } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { ReferenceDataManager } from "@/components/features/admin/ReferenceDataManager";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import {
  listReferenceData,
  listReferenceOptions,
  parseReferenceType,
} from "@/lib/reference-data";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin reference data" };

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageHref(
  type: string,
  query: string | undefined,
  page: number,
) {
  const params = new URLSearchParams({ type, page: String(page) });
  if (query) params.set("q", query);
  return `/admin/reference-data?${params.toString()}`;
}

export default async function AdminReferenceDataPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAdminPermission("REFERENCE_DATA_VIEW");
  const params = await searchParams;
  const type = parseReferenceType(stringParam(params.type) ?? "") ?? "countries";
  const query = stringParam(params.q)?.trim() || undefined;
  const [result, options] = await Promise.all([
    listReferenceData(user, type, {
      page: Number(stringParam(params.page) ?? 1),
      query,
    }),
    listReferenceOptions(user),
  ]);

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Maintain the reviewed country, city, and university records used by onboarding and student context."
        eyebrow="Kondo operations"
        title="Reference data"
      />
      <AdminNav currentPath="/admin/reference-data" role={user.role} />

      <div className="mt-7 flex flex-wrap gap-2">
        {(["countries", "cities", "universities"] as const).map((item) => (
          <Button
            asChild
            key={item}
            variant={type === item ? "primary" : "secondary"}
          >
            <Link href={`/admin/reference-data?type=${item}`}>
              {item[0].toUpperCase() + item.slice(1)}
            </Link>
          </Button>
        ))}
      </div>

      <Card className="mt-5">
        <form className="flex flex-col gap-3 sm:flex-row">
          <input name="type" type="hidden" value={type} />
          <input
            className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-transparent px-4 text-sm outline-none focus:border-kondo-green dark:border-white/10"
            defaultValue={query}
            name="q"
            placeholder={`Search ${type}`}
          />
          <Button type="submit">
            <Database className="h-4 w-4" /> Search
          </Button>
        </form>
      </Card>

      <ReferenceDataManager
        canManage={hasAdminPermission(user.role, "REFERENCE_DATA_MANAGE")}
        options={options}
        records={result.records}
        type={type}
      />

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Page {result.page} of {result.pageCount} · {result.total} records
        </p>
        <div className="flex gap-2">
          {result.page <= 1 ? (
            <Button disabled size="sm" variant="secondary">
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button asChild size="sm" variant="secondary">
              <Link href={pageHref(type, query, result.page - 1)}>
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
              <Link href={pageHref(type, query, result.page + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
