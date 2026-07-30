import type {
  OrganizationCapabilityKey,
  OrganizationLifecycleStatus,
  OrganizationType,
  OrganizationVerificationStatus,
} from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ORGANIZATION_TYPE_KEYS } from "@/features/organizations/registry";
import { listAdminOrganizations } from "@/lib/organization-admin";
import { ORGANIZATION_CAPABILITIES } from "@/lib/organization-capabilities";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin organizations" };

const LIFECYCLES = ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"] as const;
const VERIFICATIONS = [
  "NOT_SUBMITTED",
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "MORE_INFORMATION_REQUIRED",
  "SUSPENDED",
  "REVOKED",
] as const;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function member<T extends readonly string[]>(
  values: T,
  value: string | undefined,
) {
  return value && values.includes(value) ? (value as T[number]) : undefined;
}

function pageHref(
  input: {
    q?: string;
    type?: string;
    lifecycle?: string;
    verification?: string;
    capability?: string;
    country?: string;
    city?: string;
  },
  page: number,
) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.type) params.set("type", input.type);
  if (input.lifecycle) params.set("lifecycle", input.lifecycle);
  if (input.verification) params.set("verification", input.verification);
  if (input.capability) params.set("capability", input.capability);
  if (input.country) params.set("country", input.country);
  if (input.city) params.set("city", input.city);
  if (page > 1) params.set("page", String(page));
  return `/admin/organizations?${params.toString()}`;
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireAdminPermission("ORGANIZATIONS_VIEW");
  const params = await searchParams;
  const query = one(params.q)?.trim() || undefined;
  const type = member(ORGANIZATION_TYPE_KEYS, one(params.type)) as
    OrganizationType | undefined;
  const lifecycleStatus = member(LIFECYCLES, one(params.lifecycle)) as
    OrganizationLifecycleStatus | undefined;
  const verificationStatus = member(VERIFICATIONS, one(params.verification)) as
    OrganizationVerificationStatus | undefined;
  const capability = member(
    ORGANIZATION_CAPABILITIES.map(({ key }) => key),
    one(params.capability),
  ) as OrganizationCapabilityKey | undefined;
  const countryQuery = one(params.country)?.trim() || undefined;
  const cityQuery = one(params.city)?.trim() || undefined;
  const result = await listAdminOrganizations(actor, {
    query,
    type,
    lifecycleStatus,
    verificationStatus,
    capability,
    countryQuery,
    cityQuery,
    page: Number(one(params.page) ?? 1),
  });
  const linkInput = {
    q: query,
    type,
    lifecycle: lifecycleStatus,
    verification: verificationStatus,
    capability,
    country: countryQuery,
    city: cityQuery,
  };

  return (
    <main className="mx-auto max-w-[1380px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description="Inspect professional workspaces, team ownership, lifecycle state, verification and capabilities without changing personal accounts."
        eyebrow="Kondo organizations"
        title="Organizations"
      />
      <AdminNav currentPath="/admin/organizations" role={actor.role} />
      <Card className="mt-7">
        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm"
            defaultValue={query}
            name="q"
            placeholder="Public or legal name"
          />
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={type ?? ""}
            name="type"
          >
            <option value="">All organization types</option>
            {ORGANIZATION_TYPE_KEYS.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={lifecycleStatus ?? ""}
            name="lifecycle"
          >
            <option value="">All lifecycle states</option>
            {LIFECYCLES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={verificationStatus ?? ""}
            name="verification"
          >
            <option value="">All verification states</option>
            {VERIFICATIONS.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <select
            className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
            defaultValue={capability ?? ""}
            name="capability"
          >
            <option value="">All activity areas</option>
            {ORGANIZATION_CAPABILITIES.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm"
            defaultValue={countryQuery}
            name="country"
            placeholder="Search country"
          />
          <input
            className="h-11 rounded-2xl border border-border bg-background px-4 text-sm"
            defaultValue={cityQuery}
            name="city"
            placeholder="Search city"
          />
          <Button type="submit">
            <Search className="h-4 w-4" /> Filter
          </Button>
        </form>
      </Card>

      <section className="mt-6 grid gap-3">
        {result.records.map((organization) => (
          <Link
            href={`/admin/organizations/${organization.id}`}
            key={organization.id}
          >
            <Card className="grid gap-4 transition hover:border-kondo-green/40 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-black">
                    {organization.publicName}
                  </h2>
                  {organization.isOfficialPartner ? (
                    <span className="rounded-full bg-kondo-mint px-2 py-1 text-[10px] font-black text-kondo-forest">
                      PARTNER
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {organization.type.replaceAll("_", " ")} ·{" "}
                  {organization.country.name}
                  {organization.city ? ` · ${organization.city.name}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Owner:{" "}
                  {organization.owner
                    ? `${organization.owner.firstName} ${organization.owner.lastName} · ${organization.owner.email}`
                    : "No active owner"}
                </p>
              </div>
              <div className="text-xs font-bold text-muted-foreground">
                {organization._count.memberships} team records
              </div>
              <div className="flex gap-2 text-[10px] font-black">
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {organization.lifecycleStatus}
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1">
                  {organization.verificationStatus}
                </span>
              </div>
            </Card>
          </Link>
        ))}
        {!result.records.length ? (
          <Card className="py-12 text-center">
            <h2 className="font-black">No organizations match these filters</h2>
          </Card>
        ) : null}
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Page {result.page} of {result.pageCount} · {result.total} records
        </p>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link href={pageHref(linkInput, Math.max(1, result.page - 1))}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link
              href={pageHref(
                linkInput,
                Math.min(result.pageCount, result.page + 1),
              )}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
