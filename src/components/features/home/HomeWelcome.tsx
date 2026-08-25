import type { KondoJourneyGroup } from "@prisma/client";

/**
 * The greeting, as the first slide of Kondo Life.
 *
 * It has been three things. It started as a timed overlay: a welcome sat above
 * the feed, a 2.4 second timer swapped it for the activity rail, and the
 * container animated its own height between the two — so Home appeared to
 * finish loading, then rearranged itself while being read. Removing the timer
 * fixed the movement but left a heading, then a second heading, then the rail:
 * two titles competing for the top of a phone screen, and a block whose height
 * still pushed everything under it.
 *
 * So it is a slide now. Kondo Life is already a horizontal rail of cards, and
 * the greeting is simply the card you start on — it occupies no vertical space
 * of its own, nothing below it can move, and the first thing on Home is one
 * thing rather than three.
 *
 * The context line follows the member's Journey, because Home already knows
 * the group and a greeting that ignores it would be a step backwards. One
 * line: this is a card in a rail, not a hero.
 */

const CONTEXT: Record<KondoJourneyGroup, string> = {
  PREPARING_FOR_CHINA:
    "Your next steps, and what other students are working through right now.",
  STUDYING_AND_LIVING_IN_CHINA:
    "Here’s what’s happening around your student life today.",
  CAREER_ALUMNI_AND_ENTREPRENEURSHIP:
    "What’s open to you right now, and who is building something.",
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
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-kondo-green">
        {chinaDate}
      </p>
      {/*
       * `h2`, not `h1`: the rail's own "Kondo is moving." heading owns this
       * region, and two competing headings inside one section is what the
       * separate welcome block was.
       */}
      <h2 className="mt-1.5 text-balance text-xl font-black leading-tight tracking-[-0.04em] text-kondo-ink dark:text-white">
        Welcome back, {firstName} <span aria-hidden="true">👋🏾</span>
      </h2>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {context}
      </p>
    </div>
  );
}
