import type { OpportunityLifecycleStatus } from "@prisma/client";

/**
 * Centralized opportunity lifecycle.
 *
 * Transitions are declared per actor. The browser never assigns a state
 * directly: every route resolves the actor first and then asks this module
 * whether the requested transition is legal.
 */

export type OpportunityLifecycleActor = "PUBLISHER" | "MODERATOR" | "SYSTEM";

const PUBLISHER_TRANSITIONS: Record<
  OpportunityLifecycleStatus,
  readonly OpportunityLifecycleStatus[]
> = {
  DRAFT: ["DRAFT", "PENDING_REVIEW", "PUBLISHED", "ARCHIVED"],
  PENDING_REVIEW: ["DRAFT", "ARCHIVED"],
  PUBLISHED: ["PAUSED", "CLOSED", "ARCHIVED"],
  PAUSED: ["PUBLISHED", "CLOSED", "ARCHIVED"],
  CLOSED: ["ARCHIVED"],
  EXPIRED: ["DRAFT", "ARCHIVED"],
  // A rejected opportunity may be corrected and resubmitted, but the publisher
  // can never move it straight back to PUBLISHED.
  REJECTED: ["DRAFT", "PENDING_REVIEW", "ARCHIVED"],
  REMOVED: [],
  ARCHIVED: [],
};

const MODERATOR_TRANSITIONS: Record<
  OpportunityLifecycleStatus,
  readonly OpportunityLifecycleStatus[]
> = {
  DRAFT: ["REMOVED"],
  PENDING_REVIEW: ["PUBLISHED", "REJECTED", "REMOVED"],
  PUBLISHED: ["PAUSED", "REJECTED", "REMOVED", "CLOSED"],
  PAUSED: ["PUBLISHED", "REJECTED", "REMOVED"],
  CLOSED: ["REMOVED"],
  EXPIRED: ["REMOVED"],
  REJECTED: ["PUBLISHED", "REMOVED"],
  // Restoring a removed opportunity returns it to review, never straight to
  // public visibility.
  REMOVED: ["PENDING_REVIEW", "DRAFT"],
  ARCHIVED: ["REMOVED"],
};

const SYSTEM_TRANSITIONS: Record<
  OpportunityLifecycleStatus,
  readonly OpportunityLifecycleStatus[]
> = {
  DRAFT: [],
  PENDING_REVIEW: [],
  PUBLISHED: ["EXPIRED", "CLOSED"],
  PAUSED: ["EXPIRED"],
  CLOSED: ["EXPIRED"],
  EXPIRED: [],
  REJECTED: [],
  REMOVED: [],
  ARCHIVED: [],
};

const TRANSITIONS: Record<
  OpportunityLifecycleActor,
  Record<OpportunityLifecycleStatus, readonly OpportunityLifecycleStatus[]>
> = {
  PUBLISHER: PUBLISHER_TRANSITIONS,
  MODERATOR: MODERATOR_TRANSITIONS,
  SYSTEM: SYSTEM_TRANSITIONS,
};

export class OpportunityLifecycleError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
    this.name = "OpportunityLifecycleError";
  }
}

export function canTransitionOpportunity(input: {
  actor: OpportunityLifecycleActor;
  from: OpportunityLifecycleStatus;
  to: OpportunityLifecycleStatus;
}) {
  return TRANSITIONS[input.actor][input.from].includes(input.to);
}

export function assertOpportunityTransition(input: {
  actor: OpportunityLifecycleActor;
  from: OpportunityLifecycleStatus;
  to: OpportunityLifecycleStatus;
}) {
  if (!canTransitionOpportunity(input)) {
    throw new OpportunityLifecycleError(
      `An opportunity cannot move from ${input.from} to ${input.to}.`,
    );
  }
}

/** Lifecycle states whose records may be shown on a public URL. */
export function isPubliclyExposableLifecycle(
  lifecycle: OpportunityLifecycleStatus,
) {
  return lifecycle === "PUBLISHED" || lifecycle === "CLOSED";
}

/** Lifecycle states that may appear in active (non-historical) search. */
export function isActiveSearchLifecycle(lifecycle: OpportunityLifecycleStatus) {
  return lifecycle === "PUBLISHED";
}

/** Only PUBLISHED records are eligible for indexing; CLOSED stays noindex. */
export function isIndexableLifecycle(lifecycle: OpportunityLifecycleStatus) {
  return lifecycle === "PUBLISHED";
}

export function opportunityLifecycleLabel(
  lifecycle: OpportunityLifecycleStatus,
) {
  const labels: Record<OpportunityLifecycleStatus, string> = {
    DRAFT: "Draft",
    PENDING_REVIEW: "In review",
    PUBLISHED: "Published",
    PAUSED: "Paused",
    CLOSED: "Closed",
    EXPIRED: "Expired",
    REJECTED: "Needs correction",
    REMOVED: "Removed",
    ARCHIVED: "Archived",
  };
  return labels[lifecycle];
}
