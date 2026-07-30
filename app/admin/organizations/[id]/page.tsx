import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Flag,
  Globe2,
  Image as ImageIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { OrganizationAdminActions } from "@/components/features/admin/OrganizationAdminActions";
import { OrganizationPublicAdminActions } from "@/components/features/admin/OrganizationPublicAdminActions";
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
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green">
                  <Globe2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-black">Public profile</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Publication is separate from lifecycle, verification and
                    partnership.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {hasAdminPermission(
                  actor.role,
                  "ORGANIZATION_PUBLIC_PROFILES_VIEW",
                ) ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link
                      href={`/admin/organizations/${organization.id}/public-profile-preview`}
                    >
                      Preview <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
                {organization.publicProfileStatus === "PUBLISHED" &&
                !organization.publicProfileBlockedAt &&
                organization.lifecycleStatus === "ACTIVE" ? (
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/organizations/${organization.slug}`}>
                      Open public page <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Fact
                label="Publication state"
                value={organization.publicProfileStatus}
              />
              <Fact
                label="Profile completion"
                value={`${organization.publicationReadiness.profileCompletionSummary.percentage}%`}
              />
              <Fact
                label="Moderation restriction"
                value={organization.publicProfileBlockedAt ? "Active" : "None"}
              />
              <Fact
                label="Published"
                value={
                  organization.publishedAt
                    ? new Date(organization.publishedAt).toLocaleString()
                    : "Never"
                }
              />
              <Fact
                label="Last public update"
                value={
                  organization.lastPublicUpdateAt
                    ? new Date(organization.lastPublicUpdateAt).toLocaleString()
                    : "—"
                }
              />
              <Fact
                label="Public contacts"
                value={String(
                  organization.contactChannels.filter(
                    ({ visibility }) => visibility === "PUBLIC",
                  ).length,
                )}
              />
            </dl>
            <div className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                  <ImageIcon className="h-4 w-4 text-kondo-green" />
                  Visible media
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {
                    organization.publicMedia.filter(
                      ({ visibility }) => visibility === "PUBLIC",
                    ).length
                  }{" "}
                  gallery image(s)
                </p>
              </div>
              <div className="rounded-2xl bg-muted/60 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-kondo-green" />
                  Public visibility
                </p>
                <p className="mt-2 text-sm font-semibold">
                  {organization.lifecycleStatus === "ACTIVE" &&
                  organization.publicProfileStatus === "PUBLISHED" &&
                  !organization.publicProfileBlockedAt
                    ? "Eligible for public surfaces"
                    : "Hidden from public surfaces"}
                </p>
              </div>
            </div>
            {organization.publicProfileBlockReason ? (
              <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-950 dark:bg-amber-400/10 dark:text-amber-100">
                Restriction reason: {organization.publicProfileBlockReason}
              </p>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <Flag className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black">
                Related reports · {organization.reports.length}
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {organization.reports.map((report) => (
                <Link
                  className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 p-4 transition hover:bg-muted"
                  href={`/admin/reports/${report.id}`}
                  key={report.id}
                >
                  <div>
                    <p className="text-sm font-black">
                      {report.reason.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelativeDate(report.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-card px-3 py-1 text-xs font-black">
                    {report.status}
                  </span>
                </Link>
              ))}
              {!organization.reports.length ? (
                <p className="text-sm text-muted-foreground">
                  No reports currently reference this organization.
                </p>
              ) : null}
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
            <div className="mt-5">
              <OrganizationPublicAdminActions
                blocked={Boolean(organization.publicProfileBlockedAt)}
                canModerate={hasAdminPermission(
                  actor.role,
                  "ORGANIZATION_PUBLIC_PROFILES_MODERATE",
                )}
                canRestore={hasAdminPermission(
                  actor.role,
                  "ORGANIZATION_PUBLIC_PROFILES_RESTORE",
                )}
                canUnpublish={hasAdminPermission(
                  actor.role,
                  "ORGANIZATION_PUBLIC_PROFILES_UNPUBLISH",
                )}
                organizationId={organization.id}
                publicProfileStatus={organization.publicProfileStatus}
              />
            </div>
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
