import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ShieldCheck, Users } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { OrganizationAdminActions } from "@/components/features/admin/OrganizationAdminActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { getAdminOrganization } from "@/lib/organization-admin";
import { OrganizationError } from "@/lib/organizations";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin organization review" };

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPermission("ORGANIZATIONS_VIEW");
  let organization;
  try {
    organization = await getAdminOrganization(actor, (await params).id);
  } catch (error) {
    if (error instanceof OrganizationError && error.status === 404) notFound();
    throw error;
  }
  const owner = organization.memberships.find(
    (membership) =>
      membership.status === "ACTIVE" && membership.role === "OWNER",
  );

  return (
    <main className="mx-auto max-w-[1260px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/organizations">
          <ArrowLeft className="h-4 w-4" /> Organizations
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`${organization.type.replaceAll("_", " ")} · ${organization.country.name}${organization.city ? ` · ${organization.city.name}` : ""}`}
          eyebrow="Organization operations"
          title={organization.publicName}
        />
      </div>
      <AdminNav
        currentPath={`/admin/organizations/${organization.id}`}
        role={actor.role}
      />

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-kondo-mint text-kondo-green">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black">Organization profile</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {organization.tagline ??
                    organization.shortDescription ??
                    "No public summary."}
                </p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <Fact label="Legal name" value={organization.legalName ?? "—"} />
              <Fact label="Slug" value={organization.slug} />
              <Fact label="Lifecycle" value={organization.lifecycleStatus} />
              <Fact
                label="Verification"
                value={organization.verificationStatus}
              />
              <Fact
                label="Official partner"
                value={organization.isOfficialPartner ? "Yes" : "No"}
              />
              <Fact
                label="Suspension reason"
                value={organization.suspensionReason ?? "—"}
              />
              <Fact
                label="Created"
                value={new Date(organization.createdAt).toLocaleString()}
              />
            </dl>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs font-bold text-muted-foreground">
                Activity areas
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {organization.capabilities.map((capability) => (
                  <span
                    className="rounded-full bg-muted px-3 py-1 text-[10px] font-black"
                    key={capability.key}
                  >
                    {capability.key.replaceAll("_", " ")} · {capability.status}
                  </span>
                ))}
                {!organization.capabilities.length ? (
                  <span className="text-xs text-muted-foreground">
                    No activity area configured.
                  </span>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black">
                Team · {organization.memberships.length}
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {organization.memberships.map((membership) => (
                <div
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-4"
                  key={membership.userId}
                >
                  <div>
                    <p className="text-sm font-black">
                      {membership.user.firstName} {membership.user.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {membership.user.email} · {membership.user.status}
                    </p>
                  </div>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-black">
                    {membership.role} · {membership.status}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Active owner:{" "}
              {owner
                ? `${owner.user.firstName} ${owner.user.lastName}`
                : "missing — investigate before member changes"}
            </p>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black">Verification history</h2>
            </div>
            <div className="mt-4 grid gap-3">
              {organization.verificationRequests.map((request) => (
                <Link
                  className="rounded-2xl bg-muted/60 p-4 transition hover:bg-muted"
                  href={`/admin/organization-verifications/${request.id}`}
                  key={request.id}
                >
                  <p className="text-sm font-black">{request.status}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Version {request.version} ·{" "}
                    {request.submittedAt
                      ? new Date(request.submittedAt).toLocaleString()
                      : "Draft"}
                  </p>
                </Link>
              ))}
              {!organization.verificationRequests.length ? (
                <p className="text-sm text-muted-foreground">
                  No organization verification request.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="font-black">Organization activity</h2>
            <div className="mt-4 grid gap-3">
              {organization.auditLogs.map((log) => (
                <div className="rounded-2xl bg-muted/60 p-4" key={log.id}>
                  <p className="text-sm font-black">
                    {log.action.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {log.actor
                      ? `${log.actor.firstName} ${log.actor.lastName}`
                      : "System"}{" "}
                    · {formatRelativeDate(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <h2 className="font-black">Administrative controls</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Every change requires a reason and is written to the centralized
            audit log.
          </p>
          <div className="mt-5">
            <OrganizationAdminActions
              canManageLifecycle={
                hasAdminPermission(actor.role, "ORGANIZATIONS_SUSPEND") ||
                hasAdminPermission(actor.role, "ORGANIZATIONS_ARCHIVE")
              }
              canManagePartner={hasAdminPermission(
                actor.role,
                "ORGANIZATION_PARTNER_STATUS_MANAGE",
              )}
              isOfficialPartner={organization.isOfficialPartner}
              lifecycleStatus={organization.lifecycleStatus}
              organizationId={organization.id}
              verificationStatus={organization.verificationStatus}
            />
          </div>
        </Card>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}
