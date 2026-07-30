import type { OrganizationVerificationRequestStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { listOrganizationVerificationRequests } from "@/lib/organization-verification";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin organization verification",
};

const STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "MORE_INFORMATION_REQUIRED",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "REVOKED",
] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOrganizationVerificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminPermission("ORGANIZATION_VERIFICATIONS_VIEW");
  const params = await searchParams;
  const rawStatus = one(params.status);
  const status = STATUSES.includes(rawStatus as (typeof STATUSES)[number])
    ? (rawStatus as OrganizationVerificationRequestStatus)
    : undefined;
  const query = one(params.q)?.trim() || undefined;
  const result = await listOrganizationVerificationRequests(actor, {
    status,
    query,
    page: Number(one(params.page) ?? 1),
  });

  return (
    <main className="mx-auto max-w-[1260px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Review private evidence with least-privilege access. Verification and Kondo partner status remain separate decisions."
        eyebrow="Kondo trust operations"
        title="Organization verification"
      />
      <AdminNav
        currentPath="/admin/organization-verifications"
        role={actor.role}
      />
      <Card className="mt-7">
        <form className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_260px_auto]">
          <input
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm"
            defaultValue={query}
            name="q"
            placeholder="Organization name"
          />
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={status ?? ""}
            name="status"
          >
            <option value="">All request states</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>
      <section className="mt-6 grid gap-3">
        {result.records.map((request) => (
          <Link
            href={`/admin/organization-verifications/${request.id}`}
            key={request.id}
          >
            <Card className="grid gap-3 transition hover:border-kondo-green/40 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div>
                <h2 className="font-black">
                  {request.organization.publicName}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {request.organization.type.replaceAll("_", " ")} · submitted
                  by {request.submittedBy.firstName}{" "}
                  {request.submittedBy.lastName} · {request._count.documents}{" "}
                  documents
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-black">
                  {request.status}
                </span>
                <p className="mt-2 text-xs text-muted-foreground">
                  {request.submittedAt
                    ? new Date(request.submittedAt).toLocaleString()
                    : "Draft not submitted"}
                </p>
              </div>
            </Card>
          </Link>
        ))}
        {!result.records.length ? (
          <Card className="py-12 text-center">
            <h2 className="font-black">No verification requests found</h2>
          </Card>
        ) : null}
      </section>
      <p className="mt-6 text-xs text-muted-foreground">
        Page {result.page} of {result.pageCount} · {result.total} requests
      </p>
    </main>
  );
}
