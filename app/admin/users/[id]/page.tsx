import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock3,
  FileWarning,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { AccountRequestActions } from "@/components/features/admin/AccountRequestActions";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { UserStatusActions } from "@/components/features/admin/UserStatusActions";
import { UserRoleActions } from "@/components/features/admin/UserRoleActions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { getAdminUser, ProfileError } from "@/lib/profiles";
import { formatRelativeDate } from "@/lib/presentation";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin user review" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPermission("USER_VIEW");
  let user;
  try {
    user = await getAdminUser(actor, (await params).id);
  } catch (error) {
    if (error instanceof ProfileError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/users">
          <ArrowLeft className="h-4 w-4" /> Users
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description="Operational profile review with private account fields, visibility choices, report history, and reviewed account requests."
          eyebrow="Kondo operations"
          title={user.fullName}
        />
      </div>
      <AdminNav currentPath={`/admin/users/${user.id}`} role={actor.role} />

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <Avatar
                className="h-20 w-20 text-xl"
                firstName={user.firstName}
                lastName={user.lastName}
                mediaId={user.avatarMediaId}
                seed={user.id}
              />
              <div>
                <h2 className="text-xl font-black text-kondo-ink dark:text-white">
                  {user.fullName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {user.username ? `@${user.username} · ` : ""}
                  {user.role} · {user.status}
                </p>
                <Button asChild className="mt-3" size="sm" variant="secondary">
                  <Link href={`/profile/${user.username ?? user.id}`}>
                    Open member view
                  </Link>
                </Button>
              </div>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {user.bio ?? "No bio."}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Fact icon={UserRound} label="Email" value={user.email} />
              <Fact
                icon={UserRound}
                label="Phone"
                value={user.phone ?? "Not provided"}
              />
              <Fact
                icon={UserRound}
                label="Location"
                value={`${user.country?.name ?? "—"} · ${user.city?.name ?? "—"}`}
              />
              <Fact
                icon={UserRound}
                label="University"
                value={user.university?.name ?? "Not selected"}
              />
              <Fact
                icon={Clock3}
                label="Joined"
                value={new Date(user.createdAt).toLocaleString()}
              />
              <Fact
                icon={Clock3}
                label="Last active"
                value={
                  user.lastActiveAt
                    ? new Date(user.lastActiveAt).toLocaleString()
                    : "No recorded activity"
                }
              />
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Account requests
            </h2>
            <div className="mt-4 space-y-4">
              {user.accountRequests.map((request) => (
                <div
                  className="rounded-2xl border border-slate-200 p-4 dark:border-white/10"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-kondo-ink dark:text-white">
                      {request.type.replaceAll("_", " ")}
                    </p>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black text-muted-foreground dark:bg-white/10 dark:text-muted-foreground">
                      {request.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {request.reason ?? "No member reason provided."}
                  </p>
                  {request.responseNote ? (
                    <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-white/5">
                      {request.responseNote}
                    </p>
                  ) : null}
                  {hasAdminPermission(actor.role, "ACCOUNT_REQUEST_MANAGE") ? (
                    <AccountRequestActions
                      requestId={request.id}
                      status={request.status}
                      version={request.version}
                    />
                  ) : null}
                </div>
              ))}
              {!user.accountRequests.length ? (
                <p className="text-sm text-muted-foreground">
                  No account requests.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Reports about this member
            </h2>
            <div className="mt-4 space-y-3">
              {user.reports.map((report) => (
                <Link
                  className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5"
                  href={`/admin/reports/${report.id}`}
                  key={report.id}
                >
                  <FileWarning className="h-5 w-5 text-orange-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-kondo-ink dark:text-white">
                      {report.targetType} · {report.reason}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {report.status} ·{" "}
                      {formatRelativeDate(new Date(report.createdAt))}
                    </span>
                  </span>
                </Link>
              ))}
              {!user.reports.length ? (
                <p className="text-sm text-muted-foreground">
                  No reports about this member.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Public content summary
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Public posts, active Marketplace listings, and public community
              memberships only. Private conversations are never shown here.
            </p>
            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              <ContentLinks
                empty="No public posts."
                items={user.posts.map((post) => ({
                  href: `/communities/${post.community.slug}`,
                  label: post.title ?? post.content.slice(0, 70),
                  meta: post.community.name,
                }))}
                title="Posts"
              />
              <ContentLinks
                empty="No active listings."
                items={user.marketplaceListings.map((listing) => ({
                  href: `/marketplace/${listing.slug}`,
                  label: listing.title,
                  meta: listing.status,
                }))}
                title="Marketplace"
              />
              <ContentLinks
                empty="No public communities."
                items={user.communityMemberships.map((membership) => ({
                  href: `/communities/${membership.community.slug}`,
                  label: membership.community.name,
                  meta: membership.role,
                }))}
                title="Communities"
              />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {hasAdminPermission(actor.role, "USER_ROLE_MANAGE") &&
          actor.id !== user.id ? (
            <UserRoleActions initialRole={user.role} userId={user.id} />
          ) : null}
          {hasAdminPermission(actor.role, "USER_MANAGE") &&
          actor.id !== user.id ? (
            <UserStatusActions initialStatus={user.status} userId={user.id} />
          ) : null}
          <Card>
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black text-kondo-ink dark:text-white">
                Visibility choices
              </h2>
            </div>
            <dl className="mt-5 space-y-3">
              <Visibility label="Whole profile" value={user.profileAudience} />
              <Visibility label="Location" value={user.locationAudience} />
              <Visibility label="Education" value={user.educationAudience} />
              <Visibility label="Languages" value={user.languagesAudience} />
              <Visibility
                label="Communities"
                value={user.communitiesAudience}
              />
              <Visibility label="Activity" value={user.activityAudience} />
              <Visibility
                label="Marketplace"
                value={user.marketplaceAudience}
              />
            </dl>
          </Card>
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Content and sessions
            </h2>
            <dl className="mt-5 grid grid-cols-2 gap-4 text-center">
              {Object.entries(user._count).map(([label, value]) => (
                <div
                  className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5"
                  key={label}
                >
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-xl font-black text-kondo-ink dark:text-white">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
      <Icon className="mt-0.5 h-4 w-4 text-kondo-green" />
      <div>
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <p className="mt-1 break-all text-sm font-semibold text-kondo-ink dark:text-white">
          {value}
        </p>
      </div>
    </div>
  );
}

function Visibility({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3 last:border-0 dark:border-white/10">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xs font-black text-kondo-green">{value}</dd>
    </div>
  );
}

function ContentLinks({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ href: string; label: string; meta: string }>;
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <Link
            className="block rounded-xl bg-slate-50 p-3 text-sm transition hover:text-kondo-green dark:bg-white/5"
            href={item.href}
            key={`${item.href}-${item.label}`}
          >
            <span className="block font-bold text-kondo-ink dark:text-white">
              {item.label}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {item.meta}
            </span>
          </Link>
        ))}
        {!items.length ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : null}
      </div>
    </div>
  );
}
