import type { GuideContentStatus, Prisma } from "@prisma/client";

/**
 * How much Kondo is willing to claim for a piece of Guide information.
 *
 * A student uses this to decide whether to act — on a residence permit
 * deadline, on a payment setup, on what to do in their first week. Getting the
 * confidence level wrong is worse than having no article: an unsourced
 * instruction that looks official is how someone misses a legal deadline.
 *
 * So the two questions are kept apart. `published` decides whether a guide is
 * visible at all. `contentStatus` decides what Kondo says about it. A guide can
 * be perfectly useful and still honestly say nobody has checked it lately.
 */

/** Only these are ever offered to a reader. */
export const READABLE_GUIDE_STATUSES: GuideContentStatus[] = [
  "VERIFIED",
  "NEEDS_REVIEW",
];

/**
 * The filter every reader-facing guide query must use.
 *
 * DRAFT is unfinished and ARCHIVED is withdrawn; neither belongs in discovery,
 * search or recommendations, and leaving that to each call site is how one of
 * them eventually forgets.
 */
export const readableGuideWhere = {
  published: true,
  contentStatus: { in: READABLE_GUIDE_STATUSES },
} satisfies Prisma.GuideWhereInput;

export type GuideTrust = {
  /** Whether Kondo vouches for this content. */
  verified: boolean;
  /** "Last reviewed August 2026", or null when it never has been. */
  reviewedLabel: string | null;
  /** Shown when a verified guide is overdue for its next check. */
  reviewOverdue: boolean;
  /** What to tell the reader, in one short line. */
  note: string;
};

const MONTH_YEAR = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

/**
 * The trust line for a guide.
 *
 * Deliberately quiet. A large green VERIFIED banner would make the unbadged
 * guides look broken and would put the loudest element of the page on
 * something that is not the information itself. The reader needs to be able to
 * find out; they do not need to be told at volume.
 */
export function guideTrust(guide: {
  contentStatus: GuideContentStatus;
  lastVerifiedAt: Date | null;
  reviewDueAt: Date | null;
  sourceCount?: number;
}): GuideTrust {
  const verified = guide.contentStatus === "VERIFIED";
  const reviewedLabel = guide.lastVerifiedAt
    ? `Last reviewed ${MONTH_YEAR.format(guide.lastVerifiedAt)}`
    : null;
  const reviewOverdue = Boolean(
    verified && guide.reviewDueAt && guide.reviewDueAt.getTime() < Date.now(),
  );

  /*
   * The wording never overstates. "Not yet reviewed" is the truth for
   * everything Kondo has written but not checked against a source, and saying
   * so is the point of this table — a reader who knows the status can decide
   * how much weight to give it and where to confirm.
   */
  const note = verified
    ? reviewOverdue
      ? "Checked against official sources. Due for a fresh review."
      : "Checked against official sources."
    : "Not yet reviewed by Kondo. Confirm anything critical with your university or the official source.";

  return { verified, reviewedLabel, reviewOverdue, note };
}

/**
 * Whether a guide may be shown with a verified treatment.
 *
 * Verification requires a source. Content nobody can trace is not verified
 * however carefully it was written, and this is the check that stops an
 * editor's confidence from becoming Kondo's claim.
 */
export function mayPresentAsVerified(guide: {
  contentStatus: GuideContentStatus;
  sourceCount: number;
}) {
  return guide.contentStatus === "VERIFIED" && guide.sourceCount > 0;
}
