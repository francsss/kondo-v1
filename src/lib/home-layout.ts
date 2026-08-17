import type { KondoJourneyGroup } from "@prisma/client";

/**
 * What Home leads with, per Journey group.
 *
 * Home used to render one fixed order for everybody, which quietly assumed
 * every member was already in China. For someone still applying, the top of
 * the page was a marketplace of secondhand furniture in a city they have never
 * been to and an events list for a campus they have not joined — while the
 * checklist that actually governs their next three months sat below the fold,
 * under a feed of communities they had not joined either.
 *
 * The ordering below is not cosmetic. Each group is answering a different
 * question when it opens the app:
 *
 * - `PREPARING_FOR_CHINA` asks *what do I have to do next*. The Guide step and
 *   the Navigator checklist lead; the marketplace goes last, because buying a
 *   used kettle is not a thing you do from another country.
 * - `STUDYING_AND_LIVING_IN_CHINA` asks *what is happening around me*. The feed
 *   and local recommendations lead. This is the order Home already had, which
 *   is why it worked for exactly this group and nobody else.
 * - `CAREER_ALUMNI_AND_ENTREPRENEURSHIP` asks *what is open to me now*. Their
 *   arrival checklist is finished, so the Guide card drops down the page and
 *   opportunities move up.
 *
 * `FEED` stays present in every order. Reordering the page is worth doing;
 * hiding a surface a member may still want is not, so nothing is removed —
 * only moved.
 */

export const HOME_SECTIONS = [
  "FEED",
  "GUIDE_NEXT_STEP",
  "NAVIGATOR",
  "LOCAL_RECOMMENDATIONS",
  "OPPORTUNITIES",
  "MARKETPLACE",
] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number];

const ORDERS: Record<KondoJourneyGroup, readonly HomeSection[]> = {
  PREPARING_FOR_CHINA: [
    "GUIDE_NEXT_STEP",
    "NAVIGATOR",
    "FEED",
    "OPPORTUNITIES",
    "LOCAL_RECOMMENDATIONS",
    "MARKETPLACE",
  ],
  STUDYING_AND_LIVING_IN_CHINA: [
    "FEED",
    "GUIDE_NEXT_STEP",
    "NAVIGATOR",
    "LOCAL_RECOMMENDATIONS",
    "MARKETPLACE",
    "OPPORTUNITIES",
  ],
  CAREER_ALUMNI_AND_ENTREPRENEURSHIP: [
    "FEED",
    "OPPORTUNITIES",
    "NAVIGATOR",
    "LOCAL_RECOMMENDATIONS",
    "GUIDE_NEXT_STEP",
    "MARKETPLACE",
  ],
};

export function homeSectionOrder(
  group: KondoJourneyGroup | null | undefined,
): readonly HomeSection[] {
  // An unknown group gets the in-China order, which is the one Home shipped
  // with — an unrecognised value should not change what a member already sees.
  return (
    ORDERS[group ?? "STUDYING_AND_LIVING_IN_CHINA"] ??
    ORDERS.STUDYING_AND_LIVING_IN_CHINA
  );
}

/**
 * Whether the feed leads the page for this group. The composer and the "For
 * you" heading belong with the feed, so they travel with it rather than being
 * pinned to the top of a page whose top is now something else.
 */
export function feedLeadsHome(group: KondoJourneyGroup | null | undefined) {
  return homeSectionOrder(group)[0] === "FEED";
}

/**
 * The right-hand column answers "where am I", which is a different question
 * before you arrive. Someone still applying has no city set, so the card that
 * reads "Location not set" is replaced by the city they are aiming at.
 */
export function showsLocalPresence(
  group: KondoJourneyGroup | null | undefined,
) {
  return group !== "PREPARING_FOR_CHINA";
}
