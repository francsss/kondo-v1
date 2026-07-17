import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { CommunityAdminActions } from "@/components/features/admin/CommunityAdminActions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getAdminCommunity } from "@/lib/communities";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = { title: "Admin community" };

export default async function AdminCommunityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdminPermission("COMMUNITY_CMS_VIEW");
  const community = await getAdminCommunity(user, (await params).id);
  if (!community) notFound();

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <PageHeader
        description={`${community.type} · ${community.joinPolicy} · owned by ${community.owner.fullName}`}
        eyebrow="Community CMS"
        title={community.name}
      />
      <AdminNav currentPath={`/admin/communities/${community.id}`} role={user.role} />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link href="/admin/communities">
            <ArrowLeft className="h-4 w-4" /> All communities
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/communities/${community.slug}`}>
            Public view <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/communities/${community.slug}/manage`}>
            Operational management <Users className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <CommunityAdminActions
            communityId={community.id}
            initialStatus={community.status}
            initialVerified={community.isVerified}
          />
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Ownership
            </h2>
            <p className="mt-3 font-bold text-kondo-ink dark:text-white">
              {community.owner.fullName}
            </p>
            <p className="text-xs text-slate-400">{community.owner.email}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Stat label="Members" value={community.members.length} />
              <Stat label="Posts" value={community.posts.length} />
              <Stat
                label="Pending access"
                value={community.accessRequests.length}
              />
              <Stat label="Private" value={community.isPrivate ? "Yes" : "No"} />
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Community record
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
              {community.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span>{community.status}</span>
              <span>·</span>
              <span>{community.type}</span>
              <span>·</span>
              <span>{community.joinPolicy}</span>
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Recent members
            </h2>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-white/10">
              {community.members.slice(0, 20).map((member) => (
                <div
                  className="flex items-center justify-between gap-3 py-3 first:pt-0"
                  key={member.id}
                >
                  <div>
                    <p className="text-sm font-bold text-kondo-ink dark:text-white">
                      {member.user.fullName}
                    </p>
                    <p className="text-xs text-slate-400">{member.user.email}</p>
                  </div>
                  <span className="text-[10px] font-black text-kondo-green">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              Content overview
            </h2>
            <div className="mt-4 space-y-3">
              {community.posts.slice(0, 30).map((post) => (
                <div
                  className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5"
                  key={post.id}
                >
                  <p className="text-xs font-black text-kondo-green">
                    {post.type} · {post.status}
                  </p>
                  <p className="mt-1 font-bold text-kondo-ink dark:text-white">
                    {post.title ?? post.content.slice(0, 120)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {post.author.fullName} · {post._count.comments} comments ·{" "}
                    {post._count.reactions} reactions
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 font-black text-kondo-ink dark:text-white">{value}</dd>
    </div>
  );
}
