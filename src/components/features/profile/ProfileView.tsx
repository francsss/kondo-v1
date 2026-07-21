import Link from "next/link";
import {
  BookOpenText,
  Languages,
  MapPin,
  Pencil,
  ShoppingBag,
} from "lucide-react";
import { MessageUserButton } from "@/components/features/messages/MessageUserButton";
import { ProfileSafetyActions } from "@/components/features/profile/ProfileSafetyActions";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { getPublicProfile } from "@/lib/profiles";
import { formatPrice, formatRelativeDate } from "@/lib/presentation";

type Profile = Awaited<ReturnType<typeof getPublicProfile>>;
type ActivityItem = NonNullable<Profile["activity"]>[number];
type SavedItem = {
  type: string;
  title: string;
  subtitle: string;
  href: string;
  savedAt: string;
};

export function ProfileView({
  profile,
  currentUserId,
  tab = "activity",
  saved = [],
}: {
  profile: Profile;
  currentUserId: string;
  tab?: "activity" | "marketplace" | "saved";
  saved?: SavedItem[];
}) {
  const own = profile.viewer.isOwner;
  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <section className="relative overflow-hidden rounded-4xl border border-border bg-card text-card-foreground">
        <div className="noise h-36 bg-gradient-to-br from-kondo-mint via-emerald-100 to-kondo-lime/70 dark:from-emerald-900/40 dark:to-lime-900/20" />
        <div className="relative px-6 pb-7 sm:px-8">
          <div className="-mt-12 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <Avatar
              className="h-24 w-24 border-4 border-card text-2xl"
              firstName={profile.firstName}
              lastName={profile.lastName}
              mediaId={profile.avatar?.id}
            />
            <div className="flex flex-wrap gap-2">
              {own ? (
                <Button asChild variant="secondary">
                  <Link href="/profile/edit">
                    <Pencil className="h-4 w-4" /> Edit profile
                  </Link>
                </Button>
              ) : profile.viewer.canMessage ? (
                <MessageUserButton
                  currentUserId={currentUserId}
                  userId={profile.id}
                />
              ) : null}
            </div>
          </div>
          <div className="mt-5">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-kondo-ink dark:text-white">
              {profile.fullName}
            </h1>
            {profile.username ? (
              <p className="mt-1 text-sm font-semibold text-kondo-green">
                @{profile.username}
              </p>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {profile.bio ?? "Kondo student community member."}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-muted-foreground">
            {profile.location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />{" "}
                {profile.location.city?.name ??
                  profile.location.country?.name ??
                  "China"}
              </span>
            ) : null}
            {profile.education ? (
              <span className="inline-flex items-center gap-1.5">
                <BookOpenText className="h-4 w-4" />
                {profile.education.degree ??
                  profile.education.university?.name ??
                  "Student"}
              </span>
            ) : null}
            {profile.languages?.length ? (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="h-4 w-4" />
                {profile.languages.join(", ")}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-7 grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <Card>
            <h2 className="font-black text-kondo-ink dark:text-white">
              At a glance
            </h2>
            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <Count label="Groups" value={profile.counts.communities} />
              <Count label="Posts" value={profile.counts.posts} />
              <Count label="Listings" value={profile.counts.listings} />
              <Count label="Questions" value={profile.counts.questions} />
            </div>
          </Card>
          {profile.communities ? (
            <Card>
              <h2 className="font-black text-kondo-ink dark:text-white">
                Communities
              </h2>
              <div className="mt-4 space-y-3">
                {profile.communities.map((community) => (
                  <Link
                    className="flex items-center gap-3"
                    href={`/communities/${community.slug}`}
                    key={community.id}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-kondo-mint dark:bg-emerald-400/10">
                      {community.icon}
                    </span>
                    <span className="truncate text-sm font-bold text-kondo-ink dark:text-white">
                      {community.name}
                    </span>
                  </Link>
                ))}
                {!profile.communities.length ? (
                  <p className="text-sm text-muted-foreground">
                    No visible communities yet.
                  </p>
                ) : null}
              </div>
            </Card>
          ) : null}
          {!own && profile.viewer.canReport ? (
            <ProfileSafetyActions
              initiallyBlocked={profile.viewer.blockedByViewer}
              userId={profile.id}
            />
          ) : null}
        </aside>

        <section>
          {own ? (
            <div className="flex flex-wrap gap-6 border-b border-slate-200 text-sm font-bold dark:border-white/10">
              <Tab active={tab === "activity"} href="/profile">
                Activity
              </Tab>
              <Tab
                active={tab === "marketplace"}
                href="/profile?tab=marketplace"
              >
                Marketplace
              </Tab>
              <Tab active={tab === "saved"} href="/profile?tab=saved">
                Saved
              </Tab>
            </div>
          ) : (
            <h2 className="text-xl font-black text-kondo-ink dark:text-white">
              Recent activity
            </h2>
          )}

          <div className={own ? "mt-5" : "mt-4"}>
            {tab === "saved" && own ? (
              <SavedList items={saved} />
            ) : tab === "marketplace" && own ? (
              <MarketplaceList items={profile.marketplace ?? []} />
            ) : profile.activity ? (
              <ActivityList items={profile.activity} />
            ) : (
              <Card className="py-12 text-center text-sm text-muted-foreground">
                This member keeps activity private.
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Count({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xl font-black text-kondo-ink dark:text-white">
        {value ?? "—"}
      </p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Tab({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "border-b-2 border-kondo-green px-1 pb-3 text-kondo-forest dark:text-emerald-300"
          : "px-1 pb-3 text-muted-foreground hover:text-kondo-green"
      }
      href={href}
    >
      {children}
    </Link>
  );
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Link href={item.href} key={`${item.type}:${item.id}`}>
          <Card className="transition hover:-translate-y-0.5 hover:border-kondo-green/40">
            <p className="text-[10px] font-black uppercase tracking-wider text-kondo-green">
              {item.type}
            </p>
            <h3 className="mt-2 font-black text-kondo-ink dark:text-white">
              {item.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {item.subtitle}
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatRelativeDate(new Date(item.createdAt))}
            </p>
          </Card>
        </Link>
      ))}
      {!items.length ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          No visible activity yet.
        </Card>
      ) : null}
    </div>
  );
}

function MarketplaceList({
  items,
}: {
  items: NonNullable<Profile["marketplace"]>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <Link href={`/marketplace/${item.slug}`} key={item.id}>
          <Card className="h-full transition hover:-translate-y-0.5 hover:border-kondo-green/40">
            <ShoppingBag className="h-5 w-5 text-kondo-green" />
            <h3 className="mt-3 font-black text-kondo-ink dark:text-white">
              {item.title}
            </h3>
            <p className="mt-2 text-sm font-bold text-kondo-green">
              {formatPrice(item.priceFen)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.category.icon} {item.category.name} · {item.city.name}
            </p>
          </Card>
        </Link>
      ))}
      {!items.length ? (
        <Card className="py-12 text-center text-sm text-muted-foreground sm:col-span-2">
          No active listings yet.
        </Card>
      ) : null}
    </div>
  );
}

function SavedList({ items }: { items: SavedItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link href={item.href} key={`${item.type}:${item.href}`}>
          <Card className="transition hover:-translate-y-0.5 hover:border-kondo-green/40">
            <p className="text-[10px] font-black uppercase tracking-wider text-kondo-green">
              {item.type}
            </p>
            <h3 className="mt-2 font-black text-kondo-ink dark:text-white">
              {item.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.subtitle}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Saved {formatRelativeDate(new Date(item.savedAt))}
            </p>
          </Card>
        </Link>
      ))}
      {!items.length ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          No visible saved content yet.
        </Card>
      ) : null}
    </div>
  );
}
