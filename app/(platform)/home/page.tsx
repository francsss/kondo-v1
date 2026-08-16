import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { HomeActivityIntro } from "@/components/features/activity/HomeActivityIntro";
import { JourneyNavigator } from "@/components/features/navigator/JourneyNavigator";
import { PostComposer } from "@/components/features/community/PostComposer";
import { FeedPost } from "@/components/features/community/FeedPost";
import { ListingCard } from "@/components/features/marketplace/ListingCard";
import { StoryPreviewRail } from "@/components/features/stories/StoryPreviewRail";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getHomeData } from "@/lib/platform-queries";
import { getHomeActivityStream } from "@/lib/home-activity";
import { requireUser } from "@/lib/server-auth";
import { getStoryFeed } from "@/lib/stories";
import { getNavigatorActions } from "@/lib/navigator";
import { GuideNextStepCard } from "@/components/features/guides/GuideNextStepCard";
import { getGuideNextStep, guideCategoryPriority } from "@/lib/guide-journey";
import { LocalRecommendationsRail } from "@/components/features/home/LocalRecommendationsRail";
import { HomeFeedReveal } from "@/components/features/home/HomeFeedReveal";
import { recommendLocalResources } from "@/lib/local-recommendations";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const now = new Date();
  const chinaDate = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
  const chinaTime = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
  const [
    { posts, communities, listings, guides, upcomingEvents },
    activities,
    stories,
    navigator,
    nearYou,
  ] = await Promise.all([
    getHomeData(user.id),
    getHomeActivityStream(user),
    getStoryFeed(user, { limit: 10 }),
    getNavigatorActions(user.id),
    // Personalized to this member only, and never cached across members.
    recommendLocalResources({ userId: user.id, limit: 6 }),
  ]);
  /*
   * Guide order follows the precise Journey stage, not the legacy
   * `studentJourney` bucket this used to read. The two are not equivalent:
   * ADMITTED and PREPARING_ARRIVAL both fell into the same legacy bucket, and
   * they want different things first — what to pack versus how to get from the
   * airport. The stage already exists and is already loaded here.
   */
  const guidePriority = guideCategoryPriority(navigator.journey.stage ?? null);
  /*
   * Runs after the batch above because it needs the Journey stage that batch
   * resolves. Passing null to keep it inside the parallel fetch would have
   * silently turned the personalization off — one small indexed query is the
   * cheaper trade.
   */
  const guideNextStep = await getGuideNextStep({
    userId: user.id,
    stage: navigator.journey.stage ?? null,
  });
  const firstGuide = [...guides].sort((left, right) => {
    const leftRank = guidePriority.indexOf(left.category);
    const rightRank = guidePriority.indexOf(right.category);
    return (
      (leftRank < 0 ? guidePriority.length : leftRank) -
      (rightRank < 0 ? guidePriority.length : rightRank)
    );
  })[0];
  const completedSteps =
    firstGuide?.steps.filter((step) => step.progress.length > 0).length ?? 0;
  const guideProgress = firstGuide?.steps.length
    ? Math.round((completedSteps / firstGuide.steps.length) * 100)
    : 0;
  const composerCommunities = communities
    .filter((community) => community.members.length > 0)
    .map((community) => ({
      id: community.id,
      name: community.name,
      icon: community.icon,
      canAnnounce: ["OWNER", "MODERATOR"].includes(
        community.members[0]?.role ?? "",
      ),
    }));
  const journeyCard = firstGuide ? (
    <Card className="noise relative overflow-hidden border-emerald-100 bg-gradient-to-r from-kondo-navy via-kondo-forest to-[#237d61] p-0 text-white shadow-lift dark:border-emerald-400/10">
      <div className="relative z-10 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/12 text-xl">
          🛬
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-kondo-lime">
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" /> Next on your
            checklist
          </div>
          <h2 className="mt-2 text-lg font-black tracking-tight sm:text-xl">
            {firstGuide.title}
          </h2>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            {completedSteps} of {firstGuide.steps.length} steps complete · Keep
            your arrival moving smoothly.
          </p>
          <div className="mt-3 h-1.5 max-w-xl overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-kondo-lime"
              style={{ width: `${guideProgress}%` }}
            />
          </div>
        </div>
        <Button
          asChild
          className="bg-white text-kondo-forest shadow-none hover:bg-kondo-lime"
          size="sm"
        >
          <Link href={`/guides/${firstGuide.slug}`}>
            Continue <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>
      </div>
      <div
        aria-hidden="true"
        className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[45px] border-white/5"
      />
    </Card>
  ) : null;

  return (
    <div className="mx-auto max-w-[1480px] px-3 pb-28 pt-6 sm:px-5 lg:px-6 lg:pb-16 lg:pt-8 xl:px-7">
      <HomeActivityIntro
        activities={activities}
        chinaDate={chinaDate}
        communities={composerCommunities}
        firstName={user.firstName}
        generatedAt={new Date().toISOString()}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,760px)_minmax(300px,320px)] xl:justify-center">
        <div className="min-w-0 space-y-3.5 sm:space-y-4">
          <Card className="flex items-center gap-3 border-border/80 p-3.5 shadow-sm sm:p-4">
            <Avatar
              firstName={user.firstName}
              lastName={user.lastName}
              mediaId={user.avatarMediaId}
              seed={user.id}
            />
            <PostComposer
              communities={composerCommunities}
              triggerLabel="Share something with your community…"
              triggerVariant="composer"
            />
          </Card>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight text-kondo-ink dark:text-white">
                For you
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Fresh from your communities
              </p>
            </div>
            <div className="flex rounded-full bg-slate-100 p-1 text-xs font-bold dark:bg-white/5">
              <span className="rounded-full bg-white px-3 py-1.5 text-kondo-ink shadow-sm dark:bg-white/10 dark:text-white">
                Relevant
              </span>
              <span className="px-3 py-1.5 text-muted-foreground">Latest</span>
            </div>
          </div>

          {posts.length ? (
            <>
              {posts.slice(0, 2).map((post, index) => (
                <HomeFeedReveal delay={index * 0.035} key={post.id}>
                  <FeedPost currentUserId={user.id} immersive post={post} />
                </HomeFeedReveal>
              ))}
              <HomeFeedReveal>
                <StoryPreviewRail
                  compact
                  entryPoint="home"
                  eyebrow="Student Stories"
                  immersive
                  stories={stories}
                  title="Student life, as it really feels."
                />
              </HomeFeedReveal>
              {journeyCard ? (
                <HomeFeedReveal>{journeyCard}</HomeFeedReveal>
              ) : null}
              {posts.slice(2).map((post) => (
                <HomeFeedReveal key={post.id}>
                  <FeedPost currentUserId={user.id} immersive post={post} />
                </HomeFeedReveal>
              ))}
            </>
          ) : (
            <>
              <HomeFeedReveal>
                <Card className="py-14 text-center">
                  <p className="text-3xl">🌱</p>
                  <h2 className="mt-3 font-black text-kondo-ink dark:text-white">
                    Your feed is ready to grow
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Join a few communities and the conversations that matter to
                    you will appear here.
                  </p>
                  <Button asChild className="mt-5" variant="soft">
                    <Link href="/communities">Explore communities</Link>
                  </Button>
                </Card>
              </HomeFeedReveal>
              <HomeFeedReveal>
                <StoryPreviewRail
                  compact
                  entryPoint="home"
                  eyebrow="Student Stories"
                  immersive
                  stories={stories}
                  title="Student life, as it really feels."
                />
              </HomeFeedReveal>
              {journeyCard ? (
                <HomeFeedReveal>{journeyCard}</HomeFeedReveal>
              ) : null}
            </>
          )}
        </div>

        <aside className="space-y-5 xl:space-y-6">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                  Your corner of China
                </p>
                <h2 className="mt-1 flex items-center gap-1.5 font-black text-kondo-ink dark:text-white">
                  <MapPin
                    aria-hidden="true"
                    className="h-4 w-4 text-kondo-green"
                  />{" "}
                  {user.city?.name ?? "Location not set"}
                </h2>
              </div>
              <span className="text-3xl" aria-label="China">
                🇨🇳
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-kondo-cloud p-3 dark:bg-white/5">
                <p className="text-xs text-muted-foreground">Local time</p>
                <p className="mt-1 font-black text-kondo-ink dark:text-white">
                  {chinaTime}
                </p>
              </div>
              <div className="rounded-2xl bg-kondo-cloud p-3 dark:bg-white/5">
                <p className="text-xs text-muted-foreground">Time zone</p>
                <p className="mt-1 font-black text-kondo-ink dark:text-white">
                  China · UTC+8
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-kondo-ink dark:text-white">
                Upcoming near you
              </h2>
              <Button asChild size="sm" variant="ghost">
                <Link href="/communities?type=events">View all</Link>
              </Button>
            </div>
            <div className="mt-3 space-y-1">
              {upcomingEvents.length ? (
                upcomingEvents.map((event) => (
                  <Link
                    className="flex gap-3 rounded-2xl p-2.5 transition hover:bg-slate-50 dark:hover:bg-white/5"
                    href={`/communities/${event.community.slug}?post=${event.id}`}
                    key={event.id}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-orange-100 text-center text-[10px] font-black leading-3 text-orange-700 dark:bg-orange-400/10 dark:text-orange-300">
                      {event.eventAt
                        ?.toLocaleDateString("en", {
                          month: "short",
                          day: "numeric",
                        })
                        .toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-kondo-ink dark:text-white">
                        {event.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {event.eventLocation ?? event.community.name}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <p className="py-5 text-center text-sm text-muted-foreground">
                  No events this week.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-kondo-ink dark:text-white">
                Communities to know
              </h2>
              <Button asChild size="icon" variant="ghost">
                <Link aria-label="See all communities" href="/communities">
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {communities.slice(0, 4).map((community) => (
                <Link
                  className="flex items-center gap-3"
                  href={`/communities/${community.slug}`}
                  key={community.id}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-kondo-mint text-lg dark:bg-emerald-400/10">
                    {community.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-kondo-ink dark:text-white">
                      {community.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {community._count.members.toLocaleString()} members
                    </span>
                  </span>
                  <span className="text-xs font-black text-kondo-green">
                    {community.members.length ? "Joined" : "Join"}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      {/*
       * Only when there is genuinely something unfinished. An empty slot is
       * better than a card inventing a task, and the Navigator below already
       * covers the case where nothing is outstanding.
       */}
      {guideNextStep ? (
        <section className="mt-12">
          <GuideNextStepCard step={guideNextStep} />
        </section>
      ) : null}

      <JourneyNavigator
        initialActions={navigator.actions}
        initialJourney={navigator.journey}
      />

      <LocalRecommendationsRail items={nearYou.items} />

      {listings.length ? (
        <section className="mt-12">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-kondo-ink dark:text-white">
                Fresh in the marketplace
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Useful things from students near you
              </p>
            </div>
            <Button asChild variant="ghost">
              <Link href="/marketplace">
                See everything <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
