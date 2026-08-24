import type { KondoJourneyGroup } from "@prisma/client";

/**
 * The greeting, as ordinary page content.
 *
 * It used to be a timed overlay: a welcome sat above the feed, a 2.4 second
 * timer swapped it for the activity stream, and the container animated its own
 * height between the two. Everything below moved when that happened, several
 * seconds after the page had otherwise settled — so Home appeared to finish
 * loading, then rearranged itself while being read.
 *
 * This is a server component with no timer, no animation and no measured
 * height. It renders once, in the flow, and stays where it is.
 *
 * The context line still follows the member's Journey, because Home already
 * knows the group and a greeting that ignores it would be a step backwards
 * from what the page did before. It is one line: this is the top of a feed,
 * not a hero.
 */

const CONTEXT: Record<KondoJourneyGroup, string> = {
  PREPARING_FOR_CHINA:
    "Your next steps, and what other students are working through right now.",
  STUDYING_AND_LIVING_IN_CHINA:
    "Here’s what’s happening around your student life today.",
  CAREER_ALUMNI_AND_ENTREPRENEURSHIP:
    "What's open to you right now, and who is building something.",
};

export function HomeWelcome({
  chinaDate,
  firstName,
  journeyGroup,
}: {
  chinaDate: string;
  firstName: string;
  journeyGroup: KondoJourneyGroup | null;
}) {
  const context = journeyGroup
    ? CONTEXT[journeyGroup]
    : CONTEXT.STUDYING_AND_LIVING_IN_CHINA;

  return (
    <section className="min-w-0">
      <p className="text-sm font-semibold text-kondo-green">{chinaDate}</p>
      <h1 className="mt-1 text-3xl font-black tracking-[-0.045em] text-kondo-ink dark:text-white sm:text-4xl">
        Welcome back, {firstName} <span aria-hidden="true">👋🏾</span>
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">{context}</p>
    </section>
  );
}
