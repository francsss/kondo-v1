import Link from "next/link";
import { BadgeCheck, MessageCircle, Users } from "lucide-react";
import { CommunityJoinButton } from "@/components/features/community/CommunityJoinButton";
import { Card } from "@/components/ui/Card";
import { MediaImage } from "@/components/ui/MediaImage";

export function CommunityCard({
  community,
  compact = false,
}: {
  community: {
    id: string;
    slug: string;
    name: string;
    description: string;
    icon: string | null;
    coverMediaId?: string | null;
    isVerified: boolean;
    isOfficial: boolean;
    joinPolicy: "OPEN" | "REQUEST" | "INVITE_ONLY";
    members: Array<{ id: string }>;
    accessRequests?: Array<{ id: string; type: string }>;
    _count: { members: number; posts: number };
    posts?: Array<{ title: string | null; content: string }>;
  };
  compact?: boolean;
}) {
  const joined = community.members.length > 0;

  return (
    <Card className="group flex h-full flex-col overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="noise relative h-24 bg-gradient-to-br from-kondo-mint via-emerald-50 to-kondo-lime/60 dark:from-emerald-900/30 dark:via-[#14231e] dark:to-lime-900/20">
        {community.coverMediaId ? (
          <MediaImage
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            height={240}
            mediaId={community.coverMediaId}
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 90vw"
            width={720}
          />
        ) : null}
        <span className="absolute -bottom-6 left-5 grid h-14 w-14 place-items-center rounded-2xl border-4 border-card bg-card text-2xl shadow-sm">
          {community.icon ?? "✦"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 pt-9">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link
              className="inline-flex items-center gap-1 hover:underline"
              href={`/communities/${community.slug}`}
            >
              <h2 className="font-black tracking-[-0.02em] text-kondo-ink dark:text-white">
                {community.name}
              </h2>
              {community.isVerified ? (
                <BadgeCheck
                  aria-label="Verified community"
                  className="h-4 w-4 text-kondo-green"
                />
              ) : null}
            </Link>
            <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
              {community.isOfficial ? (
                <span className="rounded-full bg-kondo-mint px-2 py-0.5 font-black text-kondo-forest dark:bg-emerald-400/10 dark:text-emerald-300">
                  Official
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <Users aria-hidden="true" className="h-3.5 w-3.5" />{" "}
                {community._count.members.toLocaleString()}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />{" "}
                {community._count.posts}
              </span>
            </div>
          </div>
          <CommunityJoinButton
            communityId={community.id}
            initialJoined={joined}
            initialPending={Boolean(community.accessRequests?.length)}
            joinPolicy={community.joinPolicy}
          />
        </div>
        {!compact ? (
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
            {community.description}
          </p>
        ) : null}
        {community.posts?.[0] ? (
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs leading-5 text-muted-foreground dark:border-white/10">
            <span className="font-bold text-muted-foreground">Latest:</span>{" "}
            {community.posts[0].title ?? community.posts[0].content}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
